import chalk from 'chalk';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs/promises';
import { WorkbenchClient } from '../core/executors/workbench-client.js';
import { MissionConceptsManager } from '../core/overlays/mission-concepts/manager.js';
import { SecurityGuidelinesManager } from '../core/overlays/security-guidelines/manager.js';
import { MathematicalProofsManager } from '../core/overlays/mathematical-proofs/manager.js';
import { OperationalPatternsManager } from '../core/overlays/operational-patterns/manager.js';
import { StructuralPatternsManager } from '../core/overlays/structural-patterns/manager.js';
import { WorkspaceManager } from '../core/workspace-manager.js';
import type { SummarizeRequest } from '../core/types/workbench.js';
import type { OverlayMetadata } from '../core/algebra/overlay-algebra.js';
import {
  DEFAULT_SLM_MODEL_NAME,
  DEFAULT_MAX_OUTPUT_TOKENS,
  PERSONA_QUERY_ANALYST,
  PERSONA_KNOWLEDGE_ASSISTANT,
} from '../config.js';

interface QueryIntent {
  intent: string;
  entities: string[];
  scope: string;
  refined_query: string;
}

interface AskOptions {
  projectRoot: string;
  workbench?: string;
  topK?: number;
  save?: boolean;
  verbose?: boolean;
}

/**
 * Semantic Q&A command - ask questions about the manual and get synthesized answers.
 * Uses SLM for query deconstruction, embedding-based similarity search, and LLM for synthesis.
 */
export async function askCommand(question: string, options: AskOptions) {
  const startTime = Date.now();
  const workbenchUrl = options.workbench || 'http://localhost:8000';
  const topK = options.topK || 5;
  const verbose = options.verbose || false;

  // Find .open_cognition by walking up directory tree
  const workspaceManager = new WorkspaceManager();
  const projectRoot = workspaceManager.resolvePgcRoot(options.projectRoot);

  if (!projectRoot) {
    console.error(
      '\n❌ No .open_cognition found. Run "cognition-cli genesis:docs <path>" to create a workspace.\n'
    );
    process.exit(1);
  }

  const pgcRoot = path.join(projectRoot, '.open_cognition');

  try {
    console.log('');
    console.log(chalk.bold.cyan(`🤔 Question: ${chalk.white(question)}`));
    console.log(chalk.gray('━'.repeat(80)));
    console.log('');

    // STEP 1: Query Deconstruction (SLM)
    if (verbose) {
      console.log(chalk.dim('  [1/4] Deconstructing query intent...'));
    }

    const workbench = new WorkbenchClient(workbenchUrl);

    const deconstructRequest: SummarizeRequest = {
      content: question,
      filename: 'query.md', // Must be .md for persona to work
      persona: PERSONA_QUERY_ANALYST,
      max_tokens: 2048, // Sufficient tokens for Gemini 2.5 Flash thinking + JSON output
      temperature: 0.1,
    };
    if (DEFAULT_SLM_MODEL_NAME) {
      deconstructRequest.model_name = DEFAULT_SLM_MODEL_NAME;
    }

    const deconstructResponse = await workbench.summarize(deconstructRequest);

    // Parse JSON from response (may be wrapped in markdown code fence or mixed with text)
    let jsonMatch = deconstructResponse.summary.match(
      /```(?:json)?\s*(\{[\s\S]*?\})\s*```/
    );

    // If no markdown fence, try to find JSON object directly
    if (!jsonMatch) {
      jsonMatch = deconstructResponse.summary.match(/(\{[\s\S]*?\})/);
    }

    if (!jsonMatch) {
      if (verbose) {
        console.error(chalk.red('Failed to extract JSON from response:'));
        console.error(chalk.dim(deconstructResponse.summary));
      }
      throw new Error(
        'Query deconstruction did not return valid JSON. Use --verbose to see the raw response.'
      );
    }

    const jsonStr = jsonMatch[1];
    const queryIntent: QueryIntent = JSON.parse(jsonStr);

    if (verbose) {
      console.log(chalk.dim(`      Intent: ${queryIntent.intent}`));
      console.log(
        chalk.dim(`      Entities: ${queryIntent.entities.join(', ')}`)
      );
      console.log(chalk.dim(`      Scope: ${queryIntent.scope}`));
      console.log(chalk.dim(`      Refined: "${queryIntent.refined_query}"`));
      console.log('');
    }

    // STEP 2: Multi-Overlay Semantic Search (via Lattice Algebra)
    if (verbose) {
      console.log(
        chalk.dim(
          '  [2/4] Searching across all overlays via lattice algebra...'
        )
      );
    }

    const questionHash = crypto
      .createHash('sha256')
      .update(question)
      .digest('hex');

    // Check if we have a cached Q&A
    // TODO: Implement Q&A document search once we have the knowledge overlay

    // Initialize overlay managers (respecting overlay algebra interface)
    const overlays = [
      new StructuralPatternsManager(pgcRoot, workbenchUrl), // O1: Code symbols + docstrings (shadow of symbols)
      new SecurityGuidelinesManager(pgcRoot, workbenchUrl), // O2: Security guidelines
      new MathematicalProofsManager(pgcRoot, workbenchUrl), // O3: Mathematical proofs
      new MissionConceptsManager(pgcRoot, workbenchUrl), // O4: Mission concepts
      new OperationalPatternsManager(pgcRoot, workbenchUrl), // O5: Operational patterns
    ];

    // Query all overlays using algebra interface
    const allResults: Array<{
      item: { id: string; embedding: number[]; metadata: OverlayMetadata };
      similarity: number;
      overlay: string;
    }> = [];

    for (const overlay of overlays) {
      try {
        const results = await overlay.query(queryIntent.refined_query, topK);
        results.forEach((r) => {
          allResults.push({
            ...r,
            overlay: overlay.getOverlayId(),
          });
        });
      } catch (error) {
        // Skip overlays with no data (they may not be generated yet)
        if (verbose) {
          console.log(
            chalk.dim(
              `      ${overlay.getOverlayId()}: No data (run "overlay generate ${overlay.getOverlayName().toLowerCase().replace(/ /g, '_')}" to populate)`
            )
          );
        }
      }
    }

    if (allResults.length === 0) {
      console.error(
        chalk.red(
          '\n✗ No overlay data found. Run "cognition-cli genesis:docs docs/" to ingest knowledge.\n'
        )
      );
      process.exit(1);
    }

    // Re-rank globally and take top K
    const conceptsWithSimilarity = allResults
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
      .map((r) => {
        const metadata = r.item.metadata as {
          text: string;
          section?: string;
          weight?: number;
        };
        return {
          concept: {
            text: metadata.text,
            section: metadata.section || r.overlay,
            weight: metadata.weight || 1.0,
            embedding: r.item.embedding,
          },
          similarity: r.similarity,
          overlay: r.overlay,
        };
      });

    if (verbose) {
      console.log(
        chalk.dim(
          `      Found ${conceptsWithSimilarity.length} relevant concepts across overlays`
        )
      );
      conceptsWithSimilarity.forEach((item, i) => {
        const simPercent = (item.similarity * 100).toFixed(1);
        console.log(
          chalk.dim(
            `      ${i + 1}. [${simPercent}%] [${item.overlay}] ${item.concept.text.slice(0, 50)}...`
          )
        );
      });
      console.log('');
    }

    // STEP 3: Answer Synthesis (LLM)
    if (verbose) {
      console.log(chalk.dim('  [3/4] Synthesizing answer from concepts...'));
    }

    const contextText = conceptsWithSimilarity
      .map((item, i) => {
        return `[${i + 1}] ${item.concept.text} (Overlay: ${item.overlay}, Section: ${item.concept.section}, Weight: ${(item.concept.weight * 100).toFixed(1)}%)`;
      })
      .join('\n\n');

    const synthesisPrompt = `You are a knowledge assistant helping users understand concepts from the Foundation Manual.

Question: ${question}

Relevant concepts from the manual:
${contextText}

Provide a clear, accurate answer based ONLY on the concepts above. If the concepts don't fully answer the question, say so. Be concise but thorough.`;

    const synthesisRequest: SummarizeRequest = {
      content: synthesisPrompt,
      filename: 'synthesis.md',
      persona: PERSONA_KNOWLEDGE_ASSISTANT,
      max_tokens: DEFAULT_SLM_MODEL_NAME ? DEFAULT_MAX_OUTPUT_TOKENS : 512, // Concise for local Gemma
      temperature: 0.3,
    };
    if (DEFAULT_SLM_MODEL_NAME) {
      synthesisRequest.model_name = DEFAULT_SLM_MODEL_NAME;
    }

    const answerResponse = await workbench.summarize(synthesisRequest);

    const answer = answerResponse.summary.trim();

    if (verbose) {
      console.log('');
    }

    // STEP 4: Display Answer
    console.log(chalk.bold.green('Answer:'));
    console.log('');
    console.log(chalk.white(answer));
    console.log('');

    console.log(chalk.bold.dim('Sources:'));
    conceptsWithSimilarity.forEach((item, i) => {
      const simPercent = (item.similarity * 100).toFixed(1);
      console.log(
        chalk.dim(
          `  ${i + 1}. [${simPercent}% match] ${item.overlay} — ${item.concept.section}: ${item.concept.text.slice(0, 70)}...`
        )
      );
    });
    console.log('');

    // STEP 5: Save as markdown (optional)
    if (options.save) {
      if (verbose) {
        console.log(chalk.dim('  [4/4] Saving Q&A document...'));
      }

      const slug = question
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);

      // Normalize list marker spacing for markdown linting (MD030)
      const normalizedAnswer = answer.replace(/^(\d+\.)  +/gm, '$1 ');

      const qaMarkdown = `---
type: qa
overlay: knowledge
question_hash: ${questionHash}
asked_at: ${new Date().toISOString()}
intent: ${queryIntent.intent}
scope: ${queryIntent.scope}
---

# ${question}

**Answer**: ${normalizedAnswer}

## Query Analysis

- **Intent**: ${queryIntent.intent}
- **Entities**: ${queryIntent.entities.join(', ')}
- **Scope**: ${queryIntent.scope}
- **Refined Query**: ${queryIntent.refined_query}

## Sources

${conceptsWithSimilarity
  .map((item, i) => {
    const simPercent = (item.similarity * 100).toFixed(1);
    return `${i + 1}. **[${simPercent}% similarity]** ${item.concept.section}: ${item.concept.text}`;
  })
  .join('\n\n')}
`;

      const qaDir = path.join(pgcRoot, 'knowledge', 'qa');
      await fs.mkdir(qaDir, { recursive: true });

      const qaPath = path.join(qaDir, `${slug}.md`);
      await fs.writeFile(qaPath, qaMarkdown, 'utf-8');

      console.log(
        chalk.green(
          `✓ Q&A saved to knowledge overlay: ${chalk.dim(path.relative(process.cwd(), qaPath))}`
        )
      );
      console.log('');
    }

    // Display elapsed time
    const elapsedMs = Date.now() - startTime;
    const elapsedSeconds = (elapsedMs / 1000).toFixed(1);
    console.log(
      chalk.dim(`⏱  Completed in ${chalk.white(elapsedSeconds)} seconds`)
    );
    console.log('');
  } catch (error) {
    console.error(chalk.red('\n✗ Failed to process question:\n'));
    if (error instanceof Error) {
      console.error(chalk.dim(error.message));
      if (verbose && error.stack) {
        console.error(chalk.dim(error.stack));
      }
    }
    console.log('');
    process.exit(1);
  }
}
