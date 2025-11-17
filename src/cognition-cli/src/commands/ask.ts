/**
 * Ask Command: Semantic Q&A over the PGC and Overlays
 *
 * The ask command provides natural language question-answering over the entire knowledge base,
 * synthesizing answers from across all analytical overlays via semantic search and LLM synthesis.
 *
 * PIPELINE (4-step process):
 * 1. Query Deconstruction (SLM): Parse natural language question into intent, entities, scope
 * 2. Multi-Overlay Search (Lattice Algebra): Vector similarity search across all O1-O6 overlays
 * 3. Answer Synthesis (LLM): Generate coherent answer from top-K semantically similar concepts
 * 4. Optional Caching: Store Q&A pairs with question_hash for instant retrieval
 *
 * CACHING STRATEGY:
 * - Maintains knowledge/qa/ directory with markdown Q&A documents
 * - Stores SHA256(question) as frontmatter metadata
 * - Returns cached answers without LLM calls on repeat questions
 * - Enables knowledge base growth over time
 *
 * @example
 * // Ask a simple question
 * cognition-cli ask "What security measures should we implement?"
 *
 * @example
 * // Ask with result caching and verbose output
 * cognition-cli ask "How do we handle authentication?" --save --verbose
 *
 * @example
 * // Customize search breadth (defaults to 5 results per overlay)
 * cognition-cli ask "What are our mission principles?" --top-k 10
 */

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
 *
 * Executes full four-step pipeline:
 * 1. Checks cache first (SHA256 of question) - if hit, returns immediately
 * 2. Deconstructs query using SLM to extract intent, entities, scope
 * 3. Searches all overlays (O1-O6) using lattice algebra vector similarity
 * 4. Synthesizes answer from top-K results using LLM
 * 5. Optionally caches result to knowledge/qa/ with frontmatter metadata
 *
 * Uses SLM for query deconstruction, embedding-based similarity search via lattice algebra,
 * and LLM for answer synthesis. Results include source attribution and similarity scores.
 *
 * @param question - Natural language question to ask
 * @param options - Ask command options (project root, workbench URL, top-K, save, verbose)
 * @throws Error if PGC not found, no overlay data available, or workbench unreachable
 * @example
 * await askCommand("What is the authentication flow?", {
 *   projectRoot: process.cwd(),
 *   topK: 5,
 *   save: true,
 *   verbose: true
 * });
 */
export async function askCommand(question: string, options: AskOptions) {
  const startTime = Date.now();
  const workbenchUrl =
    options.workbench || process.env.WORKBENCH_URL || 'http://localhost:8000';
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

    // STEP 0: Check cache first (before any LLM calls)
    const questionHash = crypto
      .createHash('sha256')
      .update(question)
      .digest('hex');

    const qaDir = path.join(pgcRoot, 'knowledge', 'qa');
    try {
      const qaFiles = await fs.readdir(qaDir);
      for (const file of qaFiles) {
        if (!file.endsWith('.md')) continue;

        const qaPath = path.join(qaDir, file);
        const content = await fs.readFile(qaPath, 'utf-8');

        // Parse frontmatter to check question_hash
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (frontmatterMatch) {
          const frontmatter = frontmatterMatch[1];
          const hashMatch = frontmatter.match(/question_hash:\s*(\S+)/);

          if (hashMatch && hashMatch[1] === questionHash) {
            if (verbose) {
              console.log(
                chalk.dim('  ✓ Found cached answer (skipping LLM calls)')
              );
            }

            // Extract answer from markdown
            const answerMatch = content.match(
              /\*\*Answer\*\*:\s*(.+?)(?=\n\n##|$)/s
            );
            const sourcesMatch = content.match(/## Sources\n\n([\s\S]+)/);

            if (answerMatch) {
              console.log(chalk.bold.green('Answer (from cache):'));
              console.log('');
              console.log(chalk.white(answerMatch[1].trim()));
              console.log('');

              if (sourcesMatch) {
                console.log(chalk.bold.dim('Sources (cached):'));
                // Parse and display sources
                const sourceLines = sourcesMatch[1].split('\n\n');
                sourceLines.forEach((line) => {
                  if (line.trim()) {
                    console.log(chalk.dim(`  ${line.trim()}`));
                  }
                });
                console.log('');
              }

              const elapsedMs = Date.now() - startTime;
              const elapsedSeconds = (elapsedMs / 1000).toFixed(1);
              console.log(
                chalk.dim(
                  `⏱  Completed in ${chalk.white(elapsedSeconds)} seconds (cached)`
                )
              );
              console.log('');
              return; // Early return - no LLM calls needed!
            }
          }
        }
      }
    } catch (error) {
      // QA directory doesn't exist or other error - continue with fresh search
      if (verbose && (error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.log(
          chalk.dim(
            `  Note: Error reading Q&A cache: ${(error as Error).message}`
          )
        );
      }
    }

    // No cache hit - proceed with full flow
    if (verbose) {
      console.log(
        chalk.dim(
          '  ✗ No cached answer found, proceeding with full analysis...'
        )
      );
    }

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
          console.warn(
            `Query error for ${overlay.getOverlayId()}: ${error instanceof Error ? error.message : String(error)}`
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
