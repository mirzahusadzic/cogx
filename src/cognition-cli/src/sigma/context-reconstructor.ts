/**
 * Context Sampling Sigma - Intelligent Context Reconstructor
 *
 * Dual-mode reconstruction based on conversation intent:
 * - Quest Mode: Task-oriented with mental map and query functions
 * - Chat Mode: Discussion-oriented with linear important points
 *
 * This is the HEART of Sigma's compression intelligence.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { ConversationLattice } from './types.js';
import type { ConversationOverlayRegistry } from './conversation-registry.js';
import { filterConversationByAlignment } from './query-conversation.js';

/**
 * Conversation mode classification
 */
export type ConversationMode = 'quest' | 'chat';

/**
 * Reconstructed context for session switch
 */
export interface ReconstructedSessionContext {
  mode: ConversationMode;
  recap: string; // Markdown text to inject
  metrics: {
    nodes: number;
    paradigm_shifts: number;
    tool_uses: number;
    code_blocks: number;
    avg_structural: number;
    avg_operational: number;
  };
}

/**
 * Quest detection result
 */
interface QuestInfo {
  name: string;
  completed: boolean;
  description: string;
  lastAction: string;
  files: string[];
}

/**
 * Mental map block (high-level architecture)
 */
interface MentalMapBlock {
  name: string;
  status: 'complete' | 'in-progress' | 'pending';
  importance: number;
}

/**
 * Detect available slash commands from .claude/commands directory
 */
function detectSlashCommands(cwd: string): string[] {
  try {
    const commandsDir = path.join(cwd, '.claude', 'commands');
    if (!fs.existsSync(commandsDir)) {
      return [];
    }

    const files = fs.readdirSync(commandsDir);
    return files
      .filter((f) => f.endsWith('.md') && f !== 'README.md')
      .map((f) => `/${f.replace('.md', '')}`)
      .sort();
  } catch (err) {
    return [];
  }
}

/**
 * Generate system identity fingerprint
 * This is prepended to all compressed recaps to preserve meta-context
 */
function getSystemFingerprint(
  cwd: string,
  mode: ConversationMode,
  isCompressed: boolean
): string {
  const slashCommands = detectSlashCommands(cwd);
  const commandsList =
    slashCommands.length > 0
      ? slashCommands.map((cmd) => `\`${cmd}\``).join(', ')
      : 'None detected';

  return `# SYSTEM IDENTITY

You are **Claude Code** (Anthropic SDK) running inside **Cognition Σ (Sigma) CLI** - a verifiable AI-human symbiosis architecture with dual-lattice knowledge representation.

## What is Cognition Σ?
A portable cognitive layer that can be initialized in **any repository**. Creates \`.sigma/\` (conversation memory) and \`.open_cognition/\` (PGC project knowledge store) in the current working directory.

## Architecture Overview
- **Dual-lattice**: Local (project-specific) + Global (cross-project patterns)
- **Seven Overlays** (O1-O7): Structural, Security, Lineage, Mission, Operational, Mathematical, Coherence
- **PGC**: Content-addressable storage with SHA-256 hashing
- **Shadow Architecture**: Body (structural) + Shadow (semantic) embeddings
- **Blast radius**: Dependency tracking via lineage overlay (4 relationships: imports, extends, implements, uses)

## Available Tools
- \`recall_past_conversation\`: Semantic search across conversation history
- Query overlays for architectural reasoning (structural patterns, dependencies, mission alignment)
- Analyze coherence drift and blast radius
- Access both local lattice (this repo) and global lattice (cross-project knowledge)

## Slash Commands (from .claude/commands/)
${commandsList}

## Current Session
- **Working Directory**: \`${cwd}\`
- **Lattice Stores**: \`.sigma/\` (conversation), \`.open_cognition/\` (PGC)
- **Session Type**: ${mode}
- **Post-Compression**: ${isCompressed ? 'Yes' : 'No'}

---
`;
}

/**
 * Classify conversation mode based on lattice characteristics
 */
export function classifyConversationMode(
  lattice: ConversationLattice
): ConversationMode {
  const nodes = lattice.nodes;

  if (nodes.length === 0) return 'chat'; // Default to chat

  // Count indicators
  const toolUseTurns = nodes.filter(
    (n) =>
      n.content.includes('🔧') || // Tool progress markers
      n.content.includes('tool_use') ||
      n.content.includes('Edit:') ||
      n.content.includes('Write:') ||
      n.content.includes('Bash:')
  ).length;

  const codeBlocks = nodes.filter(
    (n) =>
      n.content.includes('```') ||
      n.content.includes('typescript') ||
      n.content.includes('python') ||
      n.content.includes('javascript')
  ).length;

  const fileReferences = nodes.filter((n) =>
    /\.(ts|tsx|js|jsx|py|md|json)/.test(n.content)
  ).length;

  // Calculate average overlay activation
  const avgO1 =
    nodes.reduce((sum, n) => sum + n.overlay_scores.O1_structural, 0) /
    nodes.length;

  const avgO5 =
    nodes.reduce((sum, n) => sum + n.overlay_scores.O5_operational, 0) /
    nodes.length;

  const avgO6 =
    nodes.reduce((sum, n) => sum + n.overlay_scores.O6_mathematical, 0) /
    nodes.length;

  // Quest indicators:
  // - High tool use (>5 tools used)
  // - High O1 (structural) + O5 (operational) + O6 (mathematical)
  // - Code blocks present
  // - File references

  const structuralScore = avgO1 + avgO5 + avgO6;
  const questScore =
    (toolUseTurns > 5 ? 3 : 0) +
    (structuralScore > 15 ? 3 : 0) +
    (codeBlocks > 3 ? 2 : 0) +
    (fileReferences > 5 ? 2 : 0);

  // Quest if score >= 5
  return questScore >= 5 ? 'quest' : 'chat';
}

/**
 * Detect current quest from lattice
 */
function detectCurrentQuest(lattice: ConversationLattice): QuestInfo {
  const nodes = lattice.nodes;

  // Find paradigm shifts (quest milestones)
  const paradigmShifts = nodes
    .filter((n) => n.is_paradigm_shift)
    .sort((a, b) => b.timestamp - a.timestamp);

  // Last paradigm shift indicates current quest
  const lastShift = paradigmShifts[0];

  if (!lastShift) {
    return {
      name: 'Development Task',
      completed: false,
      description: 'Working on codebase improvements',
      lastAction: 'Started working',
      files: [],
    };
  }

  // Extract quest name from content
  const questNameMatch = lastShift.content.match(
    /implement|build|create|add|fix|refactor|design|develop/i
  );
  const questName = questNameMatch
    ? lastShift.content.substring(0, 100).replace(/\n/g, ' ')
    : 'Current Development Task';

  // Check if completed (look for completion markers)
  const recentNodes = nodes.slice(-10);
  const completionMarkers = recentNodes.filter((n) =>
    /✅|complete|done|finished|working|passes|success/i.test(n.content)
  );

  const completed = completionMarkers.length > 3;

  // Extract files mentioned
  const fileMatches =
    lastShift.content.match(/[\w-]+\.(ts|tsx|js|jsx|py|md|json)/g) || [];
  const files = [...new Set(fileMatches)];

  // Last action from most recent high-importance turn
  const lastImportant = nodes
    .filter((n) => n.importance_score >= 7)
    .sort((a, b) => b.timestamp - a.timestamp)[0];

  const lastAction = lastImportant
    ? lastImportant.content.substring(0, 150).replace(/\n/g, ' ')
    : 'Continuing work';

  return {
    name: questName,
    completed,
    description: lastShift.content.substring(0, 200).replace(/\n/g, ' '),
    lastAction,
    files,
  };
}

/**
 * Build mental map (high-level architecture blocks)
 */
function buildMentalMap(lattice: ConversationLattice): MentalMapBlock[] {
  const nodes = lattice.nodes;

  // Group by high O1 (structural) turns
  const structuralTurns = nodes
    .filter((n) => n.overlay_scores.O1_structural >= 7)
    .sort((a, b) => b.importance_score - a.importance_score);

  // Extract architecture components
  const blocks: MentalMapBlock[] = [];

  for (const turn of structuralTurns.slice(0, 5)) {
    // Extract component name (first noun phrase or file name)
    const componentMatch = turn.content.match(
      /([A-Z][a-z]+(?:[A-Z][a-z]+)*)|(\w+\.(ts|tsx|js))/
    );
    const name = componentMatch ? componentMatch[0] : 'Component';

    // Determine status from recent mentions
    const recentMentions = nodes.filter(
      (n) =>
        n.timestamp > turn.timestamp &&
        n.content.toLowerCase().includes(name.toLowerCase())
    );

    const status: 'complete' | 'in-progress' | 'pending' =
      recentMentions.length === 0
        ? 'complete'
        : recentMentions.some((n) => n.importance_score >= 7)
          ? 'in-progress'
          : 'pending';

    blocks.push({
      name,
      status,
      importance: turn.importance_score,
    });
  }

  return blocks;
}

/**
 * Get current depth 0 (what user is working on NOW)
 */
function getCurrentDepth(lattice: ConversationLattice): {
  description: string;
  files: string[];
  lastAction: string;
} {
  const nodes = lattice.nodes;

  // Last 10 turns = current context
  const recentNodes = nodes.slice(-10);

  // Find most important recent turn
  const currentFocus = recentNodes.sort(
    (a, b) => b.importance_score - a.importance_score
  )[0];

  if (!currentFocus) {
    return {
      description: 'Starting new work',
      files: [],
      lastAction: 'Beginning',
    };
  }

  // Extract files from recent context
  const fileMatches = recentNodes.flatMap(
    (n) => n.content.match(/[\w-]+\.(ts|tsx|js|jsx|py|md|json)/g) || []
  );
  const files = [...new Set(fileMatches)];

  return {
    description: currentFocus.content.substring(0, 200).replace(/\n/g, ' '),
    files,
    lastAction: recentNodes[recentNodes.length - 1].content.substring(0, 150),
  };
}

/**
 * Reconstruct context in Quest Mode
 */
async function reconstructQuestContext(
  lattice: ConversationLattice,
  cwd: string
): Promise<string> {
  const quest = detectCurrentQuest(lattice);
  const mentalMap = buildMentalMap(lattice);
  const currentDepth = getCurrentDepth(lattice);
  const { turns, pendingTask } = getLastConversationTurns(lattice);

  const statusEmoji = quest.completed ? '✅' : '🔄';

  const fingerprint = getSystemFingerprint(cwd, 'quest', true);

  return (
    fingerprint +
    `
# Quest Context Recap

## Current Quest: ${quest.name}
${statusEmoji} Status: ${quest.completed ? 'Complete' : 'In Progress'}

${quest.description}

## Mental Map (Architecture Blocks)
${mentalMap
  .map((block) => {
    const statusIcon =
      block.status === 'complete'
        ? '✅'
        : block.status === 'in-progress'
          ? '🔄'
          : '⏳';
    return `${statusIcon} **${block.name}** (Importance: ${block.importance}/10)`;
  })
  .join('\n')}

## Current Depth 0 (Active Focus)
${currentDepth.description}

**Files Involved:**
${currentDepth.files.length > 0 ? currentDepth.files.map((f) => `- \`${f}\``).join('\n') : '- (No specific files)'}

${formatLastTurns(turns, pendingTask)}

## Query Functions Available
Use these to retrieve specific context from the lattice:

- **"What's the architecture of X?"** - Query structural overlay (O1)
- **"Show dependencies of Y"** - Query lineage overlay (O3)
- **"What did we decide about Z?"** - Semantic search via embeddings
- **"List all paradigm shifts"** - Show breakthrough moments
- **"Show code for X"** - Retrieve code blocks

---

*Continue working or query the lattice for specific context.*
`.trim()
  );
}

/**
 * Get last conversation turns with role attribution for continuity
 * FIX: Returns structured context with roles to preserve state across compression
 */
function getLastConversationTurns(lattice: ConversationLattice): {
  turns: Array<{ role: string; content: string; timestamp: number }>;
  pendingTask: string | null;
} {
  const nodes = lattice.nodes;

  // Get last 5 turns for context
  const recentNodes = nodes.slice(-5);

  // Extract turns with roles
  const turns = recentNodes.map((node) => ({
    role: node.role,
    content: node.content,
    timestamp: node.timestamp,
  }));

  // Detect if assistant has a pending task (last turn is assistant with action items)
  const lastTurn = turns[turns.length - 1];
  let pendingTask: string | null = null;

  if (lastTurn && lastTurn.role === 'assistant') {
    // Check for task indicators
    const content = lastTurn.content;
    const hasTodoList =
      content.includes('TodoWrite') || /\d+\.\s/.test(content);
    const hasToolUse = content.includes('🔧') || content.includes('Let me');
    const hasActionWords = /I'll|I will|Let me|Going to|Next I'll/.test(
      content
    );

    if (hasTodoList || hasToolUse || hasActionWords) {
      // Extract first 200 chars as pending task
      pendingTask = content.substring(0, 200).replace(/\n/g, ' ').trim();
    }
  }

  return { turns, pendingTask };
}

/**
 * Format last conversation turns for recap
 */
function formatLastTurns(
  turns: Array<{ role: string; content: string; timestamp: number }>,
  pendingTask: string | null
): string {
  if (turns.length === 0) {
    return '(No recent conversation)';
  }

  // Format each turn with role attribution
  const formattedTurns = turns
    .map((turn) => {
      const roleLabel = turn.role.toUpperCase();
      const preview = turn.content.substring(0, 150).replace(/\n/g, ' ');
      const ellipsis = turn.content.length > 150 ? '...' : '';
      return `**[${roleLabel}]**: ${preview}${ellipsis}`;
    })
    .join('\n\n');

  let result = `## Recent Conversation\n\n${formattedTurns}`;

  // Add pending task warning if present
  if (pendingTask) {
    result += `\n\n## ⚠️ Assistant's Pending Task\n\nThe assistant was in the middle of:\n> ${pendingTask}\n\n**Continue from where the assistant left off.**`;
  }

  return result;
}

/**
 * Reconstruct context in Chat Mode
 * FIX: Now uses conversation overlays for better context preservation
 * FIX: Includes last conversation turns with roles for continuity
 */
async function reconstructChatContext(
  lattice: ConversationLattice,
  cwd: string,
  conversationRegistry?: ConversationOverlayRegistry
): Promise<string> {
  const nodes = lattice.nodes;

  // Get last conversation turns with role attribution
  const { turns, pendingTask } = getLastConversationTurns(lattice);

  const fingerprint = getSystemFingerprint(cwd, 'chat', true);

  // If we have conversation registry, use overlay filtering (BETTER!)
  if (conversationRegistry) {
    try {
      const filtered = await filterConversationByAlignment(
        conversationRegistry,
        6 // Min alignment score
      );

      const hasContent =
        filtered.structural.length > 0 ||
        filtered.security.length > 0 ||
        filtered.lineage.length > 0 ||
        filtered.mission.length > 0 ||
        filtered.operational.length > 0 ||
        filtered.mathematical.length > 0 ||
        filtered.coherence.length > 0;

      if (hasContent) {
        return (
          fingerprint +
          `
# Conversation Recap

## Architecture & Design (O1 Structural)
${
  filtered.structural.length > 0
    ? filtered.structural
        .map(
          (item, i) =>
            `${i + 1}. [Score: ${item.score}/10] ${item.text.substring(0, 150)}${item.text.length > 150 ? '...' : ''}`
        )
        .join('\n\n')
    : '(None)'
}

## Security Concerns (O2 Security)
${
  filtered.security.length > 0
    ? filtered.security
        .map(
          (item, i) =>
            `${i + 1}. [Score: ${item.score}/10] ${item.text.substring(0, 150)}${item.text.length > 150 ? '...' : ''}`
        )
        .join('\n\n')
    : '(None)'
}

## Knowledge Evolution (O3 Lineage)
${
  filtered.lineage.length > 0
    ? filtered.lineage
        .map(
          (item, i) =>
            `${i + 1}. [Score: ${item.score}/10] ${item.text.substring(0, 150)}${item.text.length > 150 ? '...' : ''}`
        )
        .join('\n\n')
    : '(None)'
}

## Goals & Objectives (O4 Mission)
${
  filtered.mission.length > 0
    ? filtered.mission
        .map(
          (item, i) =>
            `${i + 1}. [Score: ${item.score}/10] ${item.text.substring(0, 150)}${item.text.length > 150 ? '...' : ''}`
        )
        .join('\n\n')
    : '(None)'
}

## Actions Taken (O5 Operational)
${
  filtered.operational.length > 0
    ? filtered.operational
        .map(
          (item, i) =>
            `${i + 1}. [Score: ${item.score}/10] ${item.text.substring(0, 150)}${item.text.length > 150 ? '...' : ''}`
        )
        .join('\n\n')
    : '(None)'
}

## Algorithms & Logic (O6 Mathematical)
${
  filtered.mathematical.length > 0
    ? filtered.mathematical
        .map(
          (item, i) =>
            `${i + 1}. [Score: ${item.score}/10] ${item.text.substring(0, 150)}${item.text.length > 150 ? '...' : ''}`
        )
        .join('\n\n')
    : '(None)'
}

## Conversation Flow (O7 Coherence)
${
  filtered.coherence.length > 0
    ? filtered.coherence
        .map(
          (item, i) =>
            `${i + 1}. [Score: ${item.score}/10] ${item.text.substring(0, 150)}${item.text.length > 150 ? '...' : ''}`
        )
        .join('\n\n')
    : '(None)'
}

${formatLastTurns(turns, pendingTask)}

---

**Memory Tool Available**: You have access to \`recall_past_conversation\` tool. Use it anytime you need to remember specific past discussions. The tool uses semantic search across all conversation history.
`.trim()
        );
      }
    } catch (err) {
      // Fall back to old method
      console.warn('Failed to use conversation overlays:', err);
    }
  }

  // FALLBACK: Old method (paradigm shifts only)
  const paradigmShifts = nodes
    .filter((n) => n.is_paradigm_shift)
    .sort((a, b) => b.importance_score - a.importance_score)
    .slice(0, 5);

  return (
    fingerprint +
    `
# Conversation Recap

## Key Points Discussed
${
  paradigmShifts.length > 0
    ? paradigmShifts
        .map((s, i) => {
          const preview = s.content.substring(0, 120).replace(/\n/g, ' ');
          return `${i + 1}. ${preview}${s.content.length > 120 ? '...' : ''}`;
        })
        .join('\n\n')
    : '(No major points yet)'
}

${formatLastTurns(turns, pendingTask)}

---

*Continue from where the assistant left off.*
`.trim()
  );
}

/**
 * Main reconstruction function - intelligently chooses mode
 */
export async function reconstructSessionContext(
  lattice: ConversationLattice,
  cwd: string,
  conversationRegistry?: ConversationOverlayRegistry
): Promise<ReconstructedSessionContext> {
  // 1. Classify conversation mode
  const mode = classifyConversationMode(lattice);

  // 2. Calculate metrics
  const nodes = lattice.nodes;
  const paradigmShifts = nodes.filter((n) => n.is_paradigm_shift).length;
  const toolUses = nodes.filter(
    (n) => n.content.includes('🔧') || n.content.includes('tool_use')
  ).length;
  const codeBlocks = nodes.filter((n) => n.content.includes('```')).length;

  const avgStructural =
    nodes.reduce((sum, n) => sum + n.overlay_scores.O1_structural, 0) /
    nodes.length;

  const avgOperational =
    nodes.reduce((sum, n) => sum + n.overlay_scores.O5_operational, 0) /
    nodes.length;

  // 3. Reconstruct based on mode (pass conversationRegistry!)
  const recap =
    mode === 'quest'
      ? await reconstructQuestContext(lattice, cwd)
      : await reconstructChatContext(lattice, cwd, conversationRegistry);

  return {
    mode,
    recap,
    metrics: {
      nodes: nodes.length,
      paradigm_shifts: paradigmShifts,
      tool_uses: toolUses,
      code_blocks: codeBlocks,
      avg_structural: Math.round(avgStructural * 10) / 10,
      avg_operational: Math.round(avgOperational * 10) / 10,
    },
  };
}
