/**
 * Context Sampling Sigma - Intelligent Context Reconstructor
 *
 * Dual-mode reconstruction based on conversation intent:
 * - Quest Mode: Task-oriented with mental map and query functions
 * - Chat Mode: Discussion-oriented with linear important points
 *
 * This is the HEART of Sigma's compression intelligence.
 */

import type {
  ConversationLattice,
  ConversationNode,
  OverlayScores,
} from './types.js';

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
 * Classify conversation mode based on lattice characteristics
 */
export function classifyConversationMode(lattice: ConversationLattice): ConversationMode {
  const nodes = lattice.nodes;

  if (nodes.length === 0) return 'chat'; // Default to chat

  // Count indicators
  const toolUseTurns = nodes.filter(n =>
    n.content.includes('🔧') || // Tool progress markers
    n.content.includes('tool_use') ||
    n.content.includes('Edit:') ||
    n.content.includes('Write:') ||
    n.content.includes('Bash:')
  ).length;

  const codeBlocks = nodes.filter(n =>
    n.content.includes('```') ||
    n.content.includes('typescript') ||
    n.content.includes('python') ||
    n.content.includes('javascript')
  ).length;

  const fileReferences = nodes.filter(n =>
    /\.(ts|tsx|js|jsx|py|md|json)/.test(n.content)
  ).length;

  // Calculate average overlay activation
  const avgO1 = nodes.reduce((sum, n) =>
    sum + n.overlay_scores.O1_structural, 0
  ) / nodes.length;

  const avgO5 = nodes.reduce((sum, n) =>
    sum + n.overlay_scores.O5_operational, 0
  ) / nodes.length;

  const avgO6 = nodes.reduce((sum, n) =>
    sum + n.overlay_scores.O6_mathematical, 0
  ) / nodes.length;

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
    .filter(n => n.is_paradigm_shift)
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
  const questNameMatch = lastShift.content.match(/implement|build|create|add|fix|refactor|design|develop/i);
  const questName = questNameMatch
    ? lastShift.content.substring(0, 100).replace(/\n/g, ' ')
    : 'Current Development Task';

  // Check if completed (look for completion markers)
  const recentNodes = nodes.slice(-10);
  const completionMarkers = recentNodes.filter(n =>
    /✅|complete|done|finished|working|passes|success/i.test(n.content)
  );

  const completed = completionMarkers.length > 3;

  // Extract files mentioned
  const fileMatches = lastShift.content.match(/[\w-]+\.(ts|tsx|js|jsx|py|md|json)/g) || [];
  const files = [...new Set(fileMatches)];

  // Last action from most recent high-importance turn
  const lastImportant = nodes
    .filter(n => n.importance_score >= 7)
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
    .filter(n => n.overlay_scores.O1_structural >= 7)
    .sort((a, b) => b.importance_score - a.importance_score);

  // Extract architecture components
  const blocks: MentalMapBlock[] = [];

  for (const turn of structuralTurns.slice(0, 5)) {
    // Extract component name (first noun phrase or file name)
    const componentMatch = turn.content.match(/([A-Z][a-z]+(?:[A-Z][a-z]+)*)|(\w+\.(ts|tsx|js))/);
    const name = componentMatch ? componentMatch[0] : 'Component';

    // Determine status from recent mentions
    const recentMentions = nodes.filter(n =>
      n.timestamp > turn.timestamp &&
      n.content.toLowerCase().includes(name.toLowerCase())
    );

    const status: 'complete' | 'in-progress' | 'pending' =
      recentMentions.length === 0 ? 'complete' :
      recentMentions.some(n => n.importance_score >= 7) ? 'in-progress' :
      'pending';

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
  const currentFocus = recentNodes
    .sort((a, b) => b.importance_score - a.importance_score)[0];

  if (!currentFocus) {
    return {
      description: 'Starting new work',
      files: [],
      lastAction: 'Beginning',
    };
  }

  // Extract files from recent context
  const fileMatches = recentNodes
    .flatMap(n => n.content.match(/[\w-]+\.(ts|tsx|js|jsx|py|md|json)/g) || []);
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
async function reconstructQuestContext(lattice: ConversationLattice): Promise<string> {
  const quest = detectCurrentQuest(lattice);
  const mentalMap = buildMentalMap(lattice);
  const currentDepth = getCurrentDepth(lattice);

  const statusEmoji = quest.completed ? '✅' : '🔄';

  return `# Quest Context Recap

## Current Quest: ${quest.name}
${statusEmoji} Status: ${quest.completed ? 'Complete' : 'In Progress'}

${quest.description}

## Mental Map (Architecture Blocks)
${mentalMap.map(block => {
  const statusIcon = block.status === 'complete' ? '✅' :
                     block.status === 'in-progress' ? '🔄' : '⏳';
  return `${statusIcon} **${block.name}** (Importance: ${block.importance}/10)`;
}).join('\n')}

## Current Depth 0 (Active Focus)
${currentDepth.description}

**Files Involved:**
${currentDepth.files.length > 0 ? currentDepth.files.map(f => `- \`${f}\``).join('\n') : '- (No specific files)'}

**Last Action:**
${currentDepth.lastAction}

## Query Functions Available
Use these to retrieve specific context from the lattice:

- **"What's the architecture of X?"** - Query structural overlay (O1)
- **"Show dependencies of Y"** - Query lineage overlay (O3)
- **"What did we decide about Z?"** - Semantic search via embeddings
- **"List all paradigm shifts"** - Show breakthrough moments
- **"Show code for X"** - Retrieve code blocks

---

*Continue working or query the lattice for specific context.*
`.trim();
}

/**
 * Find last unfinished topic in chat
 */
function findLastUnfinishedTopic(lattice: ConversationLattice): string {
  const nodes = lattice.nodes;

  // Last 5 turns
  const recentNodes = nodes.slice(-5);

  // Find last user turn (unfinished topic)
  const lastUserTurn = recentNodes
    .filter(n => n.role === 'user')
    .sort((a, b) => b.timestamp - a.timestamp)[0];

  return lastUserTurn
    ? lastUserTurn.content
    : 'No recent topic';
}

/**
 * Reconstruct context in Chat Mode
 */
async function reconstructChatContext(lattice: ConversationLattice): Promise<string> {
  const nodes = lattice.nodes;

  // Extract paradigm shifts (important points)
  const paradigmShifts = nodes
    .filter(n => n.is_paradigm_shift)
    .sort((a, b) => b.importance_score - a.importance_score)
    .slice(0, 5);

  // Find last unfinished topic
  const lastTopic = findLastUnfinishedTopic(lattice);

  return `# Conversation Recap

## Key Points Discussed
${paradigmShifts.length > 0
  ? paradigmShifts.map((s, i) => {
      const preview = s.content.substring(0, 120).replace(/\n/g, ' ');
      return `${i + 1}. ${preview}${s.content.length > 120 ? '...' : ''}`;
    }).join('\n\n')
  : '(No major points yet)'
}

## Last Topic
${lastTopic.substring(0, 300)}${lastTopic.length > 300 ? '...' : ''}

---

*Continue from here or start a new topic.*
`.trim();
}

/**
 * Main reconstruction function - intelligently chooses mode
 */
export async function reconstructSessionContext(
  lattice: ConversationLattice
): Promise<ReconstructedSessionContext> {
  // 1. Classify conversation mode
  const mode = classifyConversationMode(lattice);

  // 2. Calculate metrics
  const nodes = lattice.nodes;
  const paradigmShifts = nodes.filter(n => n.is_paradigm_shift).length;
  const toolUses = nodes.filter(n =>
    n.content.includes('🔧') || n.content.includes('tool_use')
  ).length;
  const codeBlocks = nodes.filter(n => n.content.includes('```')).length;

  const avgStructural = nodes.reduce((sum, n) =>
    sum + n.overlay_scores.O1_structural, 0
  ) / nodes.length;

  const avgOperational = nodes.reduce((sum, n) =>
    sum + n.overlay_scores.O5_operational, 0
  ) / nodes.length;

  // 3. Reconstruct based on mode
  const recap = mode === 'quest'
    ? await reconstructQuestContext(lattice)
    : await reconstructChatContext(lattice);

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
