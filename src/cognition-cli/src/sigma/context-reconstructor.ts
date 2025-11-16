/**
 * Context Sampling Sigma - Intelligent Context Reconstructor
 *
 * Dual-mode reconstruction based on conversation intent:
 * - Quest Mode: Task-oriented with mental map and query functions
 * - Chat Mode: Discussion-oriented with linear important points
 *
 * This is the HEART of Sigma's compression intelligence.
 *
 * DESIGN PHILOSOPHY:
 * When a conversation exceeds the compression threshold (50 turns), Sigma doesn't
 * just truncate or summarize. Instead, it intelligently reconstructs context
 * based on the conversation's NATURE:
 *
 * **Quest Mode** (Task/Implementation-Oriented):
 * - Detected when: High tool use, code blocks, structural/operational overlay scores
 * - Recap structure:
 *   1. Current Quest (what's being built/fixed)
 *   2. Mental Map (architectural blocks and their status)
 *   3. Current Depth 0 (immediate working context)
 *   4. Recent conversation turns (last 5 with role attribution)
 *   5. Query functions available (how to retrieve more context)
 *
 * **Chat Mode** (Discussion-Oriented):
 * - Detected when: Low tool use, conversational flow, lower structural scores
 * - Recap structure:
 *   1. Key points by overlay dimension (O1-O7 alignment filtering)
 *   2. Recent conversation turns (last 5 with role attribution)
 *   3. Recall tool availability notice
 *
 * THREE-STAGE PIPELINE:
 * 1. **Classification**: Analyze lattice metrics to determine mode
 * 2. **Extraction**: Pull relevant context (paradigm shifts, high-importance turns, overlay-aligned content)
 * 3. **Reconstruction**: Format markdown recap with system fingerprint + mode-specific content
 *
 * CRITICAL FEATURE - Pending Task Preservation:
 * The reconstructor preserves assistant state across compression. If the last turn
 * shows the assistant was mid-task (has TodoWrite, tool usage, action words like
 * "I'll", "Let me"), the recap includes a prominent warning to continue from
 * where the assistant left off. This prevents lost work and maintains continuity.
 *
 * MEMORY ARCHITECTURE:
 * - Truncated messages (150 chars) with "..." serve as POINTERS, not complete history
 * - Full context retrieval via recall_past_conversation tool (semantic search in LanceDB)
 * - System fingerprint prepended to ALL recaps to preserve meta-context
 *
 * @see classifyConversationMode - Determines quest vs chat mode
 * @see reconstructQuestContext - Builds quest-mode recap
 * @see reconstructChatContext - Builds chat-mode recap with overlay filtering
 * @see getLastConversationTurns - Extracts recent turns and detects pending tasks
 */

import type { ConversationLattice, ConversationNode } from './types.js';
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
 * Generate system identity fingerprint
 *
 * Creates the standardized header prepended to all compressed recaps. This
 * preserves critical meta-context about the Sigma system, memory architecture,
 * and available tools so the assistant understands its operating environment
 * after compression.
 *
 * DESIGN:
 * The fingerprint is a markdown document explaining:
 * 1. System identity (Claude Code + Cognition Σ)
 * 2. Architecture overview (dual-lattice, 7 overlays, PGC, shadow embeddings)
 * 3. Memory architecture (truncated pointers vs full retrieval)
 * 4. Available tools (recall, query overlays)
 * 5. Slash commands (discovery and execution)
 * 6. Current session context (working directory, lattice stores, mode)
 *
 * This ensures that after compression, the assistant knows:
 * - What system it's running in
 * - How memory works (truncated messages are POINTERS, use recall for full content)
 * - What tools are available
 * - Current session state
 *
 * CRITICAL: The "Memory Architecture" section explicitly tells the assistant
 * that "..." means more content is available and should trigger recall_past_conversation.
 * This is the key to making compressed context work effectively.
 *
 * @private
 * @param cwd - Current working directory
 * @param mode - Conversation mode (quest or chat)
 * @param isCompressed - Whether this recap is post-compression
 * @returns Markdown-formatted system fingerprint
 */
function getSystemFingerprint(
  cwd: string,
  mode: ConversationMode,
  isCompressed: boolean
): string {
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

## Memory Architecture

**Compressed Recap (What You See Above):**
- Recent conversation messages are truncated to 150 characters
- \`...\` indicates more content available - this is your signal to use the recall tool
- Think of these as **pointers/needles**, not complete verbatim history
- Designed for token efficiency while preserving navigation context

**Full Context Retrieval (Use When You See \`...\`):**
- \`recall_past_conversation\`: Retrieves FULL untruncated messages from LanceDB
- Semantic search across all 7 overlays (O1-O7) with complete conversation history
- When you see truncated content like "**File Modif...", query for full details
- Example: \`recall_past_conversation("cursor positioning implementation details")\`

## Other Available Tools
- Query overlays for architectural reasoning (structural patterns, dependencies, mission alignment)
- Analyze coherence drift and blast radius
- Access both local lattice (this repo) and global lattice (cross-project knowledge)

## Slash Commands (from .claude/commands/)

**Discovery**: List all \`.md\` files in \`.claude/commands/\` directory (each filename without extension is a command)

**Execution**: When user invokes a slash command (e.g., \`/check-alignment "concept"\`):
1. Read \`.claude/commands/[command-name].md\`
2. Parse the markdown sections:
   - **Your Task**: What to accomplish
   - **Commands to Run**: cognition-cli commands with placeholders
   - **Output Template**: How to format response
3. Replace placeholders (\`[CONCEPT]\`, \`{{FILE_PATH}}\`, \`{{ALL_ARGS}}\`) with user arguments
4. Execute cognition-cli commands via Bash tool
5. Format output following the template

**Example**: \`/check-alignment "zero-trust"\` → Read check-alignment.md → Execute commands → Format results

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
 *
 * Analyzes conversation patterns to determine whether the session is task-oriented
 * (Quest Mode) or discussion-oriented (Chat Mode). This classification drives
 * how context is reconstructed after compression.
 *
 * ALGORITHM:
 * 1. Count quest indicators:
 *    - Tool usage markers (🔧, tool_use, Edit:, Write:, Bash:)
 *    - Code blocks (```, typescript, python, javascript)
 *    - File references (.ts, .tsx, .js, .jsx, .py, .md, .json)
 * 2. Calculate average overlay scores:
 *    - O1 (Structural): Architecture/code structure
 *    - O5 (Operational): Actions/workflows
 *    - O6 (Mathematical): Algorithms/logic
 * 3. Compute quest score from indicators:
 *    - +3 points if tool uses > 5
 *    - +3 points if (O1 + O5 + O6) > 15
 *    - +2 points if code blocks > 3
 *    - +2 points if file references > 5
 * 4. Return "quest" if score >= 5, else "chat"
 *
 * DESIGN:
 * Quest mode conversations involve building, fixing, or implementing things.
 * They have high structural engagement, tool usage, and code manipulation.
 * Chat mode conversations are exploratory, discussing ideas, asking questions,
 * or planning without heavy implementation.
 *
 * The threshold (score >= 5) balances sensitivity:
 * - Too low: Casual coding chat becomes quest mode
 * - Too high: Active implementation becomes chat mode
 *
 * Score of 5 requires at least TWO strong indicators (e.g., lots of tools + code)
 * or ONE very strong indicator (e.g., many tools + high structural scores).
 *
 * @param lattice - Conversation lattice with nodes and metadata
 * @returns 'quest' for task-oriented sessions, 'chat' for discussion-oriented sessions
 *
 * @example
 * // Classify a development session
 * const lattice = await rebuildLatticeFromLanceDB(sessionId, cwd);
 * const mode = classifyConversationMode(lattice);
 *
 * console.log(`Session mode: ${mode}`);
 * if (mode === 'quest') {
 *   console.log('Task-oriented - will reconstruct with mental map');
 * } else {
 *   console.log('Discussion-oriented - will reconstruct with key points');
 * }
 *
 * @example
 * // Analyze session characteristics
 * const mode = classifyConversationMode(lattice);
 * const nodes = lattice.nodes;
 *
 * const toolUses = nodes.filter(n => n.content.includes('🔧')).length;
 * const avgO1 = nodes.reduce((s, n) => s + n.overlay_scores.O1_structural, 0) / nodes.length;
 *
 * console.log(`Mode: ${mode}`);
 * console.log(`Tool uses: ${toolUses}`);
 * console.log(`Avg structural score: ${avgO1.toFixed(2)}`);
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
 *
 * Identifies the active task/objective by analyzing paradigm shifts and
 * recent high-importance turns. Extracts quest name, completion status,
 * involved files, and last action.
 *
 * ALGORITHM:
 * 1. Find all paradigm shifts, sort by timestamp descending
 * 2. Use most recent paradigm shift as quest milestone
 * 3. Extract quest name from shift content (implementation keywords)
 * 4. Determine completion status:
 *    - Check last 10 turns for completion markers (✅, complete, done, working, passes)
 *    - If 3+ completion markers found → completed = true
 * 5. Extract involved files from paradigm shift content (.ts, .tsx, etc.)
 * 6. Find last action from most recent high-importance turn (importance >= 7)
 * 7. Return QuestInfo with all extracted metadata
 *
 * DESIGN:
 * Paradigm shifts mark significant cognitive moments - usually when a major
 * task begins or a breakthrough occurs. The most recent shift indicates the
 * current quest focus. Completion is inferred from recent markers rather than
 * explicit state, as conversations often continue briefly after completion.
 *
 * Default quest info is returned if no paradigm shifts exist (new/simple sessions).
 *
 * @private
 * @param lattice - Conversation lattice with nodes and metadata
 * @returns Quest information (name, status, description, files, last action)
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
 *
 * Extracts high-level architectural components discussed in the conversation
 * and determines their status (complete, in-progress, pending). The mental
 * map provides a structural overview of the system being built/modified.
 *
 * ALGORITHM:
 * 1. Filter turns with high structural alignment (O1 >= 7)
 * 2. Sort by importance descending
 * 3. Take top 5 structural turns
 * 4. For each turn:
 *    a. Extract component name (PascalCase pattern or file name)
 *    b. Find recent mentions of this component
 *    c. Determine status:
 *       - No recent mentions → complete (discussion ended)
 *       - Recent high-importance mentions → in-progress (active work)
 *       - Recent low-importance mentions → pending (planned/deferred)
 * 5. Return array of mental map blocks
 *
 * DESIGN:
 * The mental map is a high-level architecture snapshot showing what components
 * were discussed and their current state. It's like a "architecture todo list"
 * derived from conversation patterns rather than explicit tracking.
 *
 * Status inference:
 * - Complete: Discussed earlier but no longer mentioned (work done)
 * - In-progress: Recently mentioned with high importance (active focus)
 * - Pending: Recently mentioned casually (acknowledged but not actively worked)
 *
 * Limit to 5 blocks prevents overwhelming the recap with minor components.
 *
 * @private
 * @param lattice - Conversation lattice with nodes and metadata
 * @returns Array of mental map blocks (up to 5 architecture components)
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
 *
 * Extracts the immediate working context - what the user is actively focused
 * on right now. This is the "top of stack" in the conversation's attention.
 *
 * ALGORITHM:
 * 1. Take last 10 turns as recent context window
 * 2. Find most important turn in this window (highest importance_score)
 * 3. Extract description from that turn's content (first 200 chars)
 * 4. Collect all file references from the 10-turn window
 * 5. Get last action from the very last turn (most recent message)
 * 6. Return current focus (description, files, last action)
 *
 * DESIGN:
 * "Depth 0" refers to the current attention level in the conversation's
 * mental stack. Deeper levels would be background context, earlier topics,
 * foundational decisions. Depth 0 is "what we're doing RIGHT NOW."
 *
 * The 10-turn window balances recency with context:
 * - Too small (5 turns): Might miss important context just mentioned
 * - Too large (20+ turns): Includes stale context no longer relevant
 *
 * Most important turn in this window represents the current focus because
 * importance indicates what matters most to the user/assistant right now.
 *
 * @private
 * @param lattice - Conversation lattice with nodes and metadata
 * @returns Current working context (description, involved files, last action)
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
 *
 * Builds a task-oriented recap for implementation/development sessions.
 * Includes quest objectives, mental map of architecture, current working
 * context, recent turns, and available query functions.
 *
 * ALGORITHM:
 * 1. Detect current quest (what's being built/fixed)
 * 2. Build mental map (architecture blocks and status)
 * 3. Get current depth 0 (immediate working context)
 * 4. Get last conversation turns (recent exchanges + pending task)
 * 5. Generate system fingerprint
 * 6. Format markdown recap with sections:
 *    - System fingerprint (identity, architecture, memory, tools)
 *    - Quest Context Recap
 *      - Current Quest (name, status, description)
 *      - Mental Map (architecture blocks with status icons)
 *      - Current Depth 0 (active focus + files)
 *      - Recent Conversation (last 5 turns with roles)
 *      - Query Functions Available (how to retrieve more context)
 * 7. Return complete markdown string
 *
 * DESIGN - Quest Mode Structure:
 * Quest mode assumes the user is BUILDING something. The recap is organized
 * like a project dashboard:
 *
 * **Quest**: What we're trying to achieve (objective)
 * **Mental Map**: High-level components and their status (architecture overview)
 * **Current Depth 0**: What we're working on RIGHT NOW (immediate focus)
 * **Recent Conversation**: Last few exchanges (conversational continuity)
 * **Query Functions**: How to get more context (discoverability)
 *
 * The mental map is unique to quest mode - it's not useful for chat mode
 * because discussions don't have "architecture blocks."
 *
 * Status emojis make the recap scannable:
 * - ✅ Complete
 * - 🔄 In Progress
 * - ⏳ Pending
 *
 * Query functions section teaches the assistant how to use Sigma's retrieval
 * tools for specific context needs.
 *
 * @private
 * @param lattice - Conversation lattice with nodes and metadata
 * @param cwd - Current working directory
 * @returns Markdown-formatted quest mode recap
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
 *
 * Extracts the most recent conversation turns (last 5) with role attribution
 * to preserve conversation flow across compression. Also detects if the assistant
 * has a pending task (was mid-work when compression occurred).
 *
 * ALGORITHM:
 * 1. Extract last 5 turns from lattice with role, content, timestamp
 * 2. Examine the very last turn
 * 3. If last turn is from assistant, check for pending task indicators:
 *    - Has TodoWrite (explicit task list)
 *    - Has tool usage markers (🔧, "Let me")
 *    - Has action words ("I'll", "I will", "Let me", "Going to", "Next I'll")
 * 4. If indicators found, extract first 200 chars as pending task description
 * 5. Return turns array + pending task (or null)
 *
 * DESIGN - CRITICAL FEATURE:
 * This function solves a major problem with conversation compression: losing
 * assistant state. When compression truncates messages, the assistant might
 * forget it was in the middle of a task.
 *
 * By detecting pending tasks from the last assistant turn, we can:
 * - Show a prominent warning in the recap
 * - Remind the assistant what it was doing
 * - Ensure continuity across compression boundary
 *
 * Pending task detection looks for:
 * - TodoWrite: Explicit task tracking
 * - Tool markers: Active work in progress
 * - Action verbs: Commitments like "I'll implement X"
 *
 * The 5-turn window provides immediate conversational context - enough to
 * understand the current exchange without overwhelming the recap.
 *
 * @private
 * @param lattice - Conversation lattice with nodes and metadata
 * @returns Recent turns (last 5 with roles) and optional pending task description
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
 *
 * Formats the recent conversation turns into markdown with role attribution
 * and truncated content. Adds a prominent warning if the assistant has a
 * pending task.
 *
 * ALGORITHM:
 * 1. For each turn:
 *    a. Format role as uppercase label [USER], [ASSISTANT], [SYSTEM]
 *    b. Truncate content to 150 characters
 *    c. Add "..." ellipsis if content was truncated
 *    d. Format as markdown: **[ROLE]**: content...
 * 2. Join all formatted turns with double newlines
 * 3. If pending task exists:
 *    a. Add "## ⚠️ Assistant's Pending Task" section
 *    b. Show the pending task description
 *    c. Add "Continue from where the assistant left off" instruction
 * 4. Return formatted markdown string
 *
 * DESIGN:
 * The truncated turns serve as POINTERS, not complete history. The "..." is
 * a deliberate signal to use recall_past_conversation for full content.
 *
 * Role attribution ([USER], [ASSISTANT]) is critical for:
 * - Understanding conversation flow
 * - Knowing who said what
 * - Maintaining continuity across compression
 *
 * The pending task warning is PROMINENT (⚠️ emoji, blockquote, bold instruction)
 * to ensure the assistant notices it and continues the work.
 *
 * @private
 * @param turns - Recent conversation turns (role, content, timestamp)
 * @param pendingTask - Optional pending task description from assistant
 * @returns Markdown-formatted recent conversation with optional pending task warning
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
 * Extract overlay-aligned turns directly from lattice (FAST PATH)
 *
 * Filters lattice nodes by overlay scores instead of querying conversation overlays.
 * This is much faster during compression because we already have the lattice in memory.
 *
 * @param lattice - Conversation lattice with nodes and overlay scores
 * @param minAlignment - Minimum overlay score to include (default: 6)
 * @returns Filtered turns organized by overlay dimension
 * @private
 */
function filterLatticeByOverlayScores(
  lattice: ConversationLattice,
  minAlignment: number = 6
): {
  structural: Array<{ text: string; score: number }>;
  security: Array<{ text: string; score: number }>;
  lineage: Array<{ text: string; score: number }>;
  mission: Array<{ text: string; score: number }>;
  operational: Array<{ text: string; score: number }>;
  mathematical: Array<{ text: string; score: number }>;
  coherence: Array<{ text: string; score: number }>;
} {
  const nodes = lattice.nodes;

  // Helper to filter and format turns for an overlay
  const filterByOverlay = (
    overlayKey: keyof ConversationNode['overlay_scores']
  ): Array<{ text: string; score: number }> => {
    return nodes
      .filter((n) => n.overlay_scores[overlayKey] >= minAlignment)
      .map((n) => ({
        text: n.content,
        score: n.overlay_scores[overlayKey],
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Top 5 per overlay
  };

  return {
    structural: filterByOverlay('O1_structural'),
    security: filterByOverlay('O2_security'),
    lineage: filterByOverlay('O3_lineage'),
    mission: filterByOverlay('O4_mission'),
    operational: filterByOverlay('O5_operational'),
    mathematical: filterByOverlay('O6_mathematical'),
    coherence: filterByOverlay('O7_strategic'), // O7 is strategic/coherence
  };
}

/**
 * Reconstruct context in Chat Mode
 *
 * Builds a discussion-oriented recap organized by overlay dimensions (O1-O7).
 * Uses conversation overlays for intelligent filtering, showing high-alignment
 * turns for each dimension. Includes recent turns and recall tool notice.
 *
 * ALGORITHM:
 * 1. Get last conversation turns (recent exchanges + pending task)
 * 2. Generate system fingerprint
 * 3. FAST PATH (during compression):
 *    a. Extract overlay-aligned turns directly from lattice (in-memory)
 *    b. Filter by overlay scores >= 6
 *    c. Build recap from lattice data (no disk I/O)
 * 4. SLOW PATH (conversation registry available but not during compression):
 *    a. Query conversation overlays with min_alignment = 6
 *    b. For each overlay dimension (O1-O7):
 *       - Filter turns with alignment >= 6 for that overlay
 *       - Format as numbered list with scores
 *       - Truncate content to 150 chars (pointers, not full text)
 *    c. Build markdown recap by overlay section
 *    d. Include recent conversation turns
 *    e. Add recall tool instructions
 * 5. FALLBACK PATH (no conversation registry):
 *    a. Extract paradigm shifts from lattice
 *    b. Show top 5 paradigm shifts as key points
 *    c. Include recent conversation turns
 *    d. Add recall tool instructions
 * 6. Return complete markdown string
 *
 * DESIGN - Chat Mode Structure:
 * Chat mode assumes the user is DISCUSSING something. The recap is organized
 * by semantic dimensions (overlays) rather than task structure:
 *
 * **Architecture & Design (O1)**: Structural discussions
 * **Security Concerns (O2)**: Security-focused turns
 * **Knowledge Evolution (O3)**: Lineage and dependencies
 * **Goals & Objectives (O4)**: Mission-aligned discussions
 * **Actions Taken (O5)**: Operational turns
 * **Algorithms & Logic (O6)**: Mathematical/algorithmic discussions
 * **Conversation Flow (O7)**: Coherence and strategic alignment
 *
 * This organization helps the assistant understand WHAT was discussed and
 * FROM WHAT PERSPECTIVE. A security-focused discussion will have high O2
 * scores, while architectural planning will have high O1 scores.
 *
 * TWO PATHS:
 * 1. **Overlay-based** (preferred): Rich filtering by alignment scores
 * 2. **Paradigm shifts** (fallback): Basic important points extraction
 *
 * The overlay-based path is superior because it:
 * - Provides multi-dimensional view of conversation
 * - Shows alignment scores (how relevant to each dimension)
 * - Preserves more nuanced context
 *
 * Fallback exists for backward compatibility when conversation registry
 * is not available.
 *
 * CRITICAL: Includes strong notice about truncated messages being POINTERS
 * and "..." meaning "use recall_past_conversation to get full content."
 *
 * @private
 * @param lattice - Conversation lattice with nodes and metadata
 * @param cwd - Current working directory
 * @param conversationRegistry - Optional conversation overlay registry (enables better filtering)
 * @returns Markdown-formatted chat mode recap
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

  // FAST PATH: Use lattice data directly (in-memory, no disk I/O)
  // This is MUCH faster than querying conversation overlays from disk
  console.log(
    '🔍 [CHAT DEBUG] Step 1: Using FAST PATH - filtering lattice by overlay scores...'
  );
  const filtered = filterLatticeByOverlayScores(lattice, 6);
  console.log(
    '🔍 [CHAT DEBUG] Step 2: Lattice filtering complete (no disk I/O!)'
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

**IMPORTANT**: The recap above shows messages truncated to 150 characters. When you see \`...\` it's a **signal** that more content is available. Use \`recall_past_conversation\` to retrieve the FULL untruncated message. Think of the recap as navigation pointers, not complete verbatim history.
`.trim()
    );
  }

  // SLOW PATH: Query conversation overlays from disk (kept for backward compatibility)
  // Only used if lattice filtering returns no content but we have conversation registry
  if (conversationRegistry) {
    console.log(
      '🔍 [CHAT DEBUG] SLOW PATH: Lattice had no content, falling back to conversation registry...'
    );
    try {
      const filteredFromDisk = await filterConversationByAlignment(
        conversationRegistry,
        6 // Min alignment score
      );

      const hasContentFromDisk =
        filteredFromDisk.structural.length > 0 ||
        filteredFromDisk.security.length > 0 ||
        filteredFromDisk.lineage.length > 0 ||
        filteredFromDisk.mission.length > 0 ||
        filteredFromDisk.operational.length > 0 ||
        filteredFromDisk.mathematical.length > 0 ||
        filteredFromDisk.coherence.length > 0;

      if (hasContentFromDisk) {
        return (
          fingerprint +
          `
# Conversation Recap

## Architecture & Design (O1 Structural)
${
  filteredFromDisk.structural.length > 0
    ? filteredFromDisk.structural
        .map(
          (item, i) =>
            `${i + 1}. [Score: ${item.score}/10] ${item.text.substring(0, 150)}${item.text.length > 150 ? '...' : ''}`
        )
        .join('\n\n')
    : '(None)'
}

## Security Concerns (O2 Security)
${
  filteredFromDisk.security.length > 0
    ? filteredFromDisk.security
        .map(
          (item, i) =>
            `${i + 1}. [Score: ${item.score}/10] ${item.text.substring(0, 150)}${item.text.length > 150 ? '...' : ''}`
        )
        .join('\n\n')
    : '(None)'
}

## Knowledge Evolution (O3 Lineage)
${
  filteredFromDisk.lineage.length > 0
    ? filteredFromDisk.lineage
        .map(
          (item, i) =>
            `${i + 1}. [Score: ${item.score}/10] ${item.text.substring(0, 150)}${item.text.length > 150 ? '...' : ''}`
        )
        .join('\n\n')
    : '(None)'
}

## Goals & Objectives (O4 Mission)
${
  filteredFromDisk.mission.length > 0
    ? filteredFromDisk.mission
        .map(
          (item, i) =>
            `${i + 1}. [Score: ${item.score}/10] ${item.text.substring(0, 150)}${item.text.length > 150 ? '...' : ''}`
        )
        .join('\n\n')
    : '(None)'
}

## Actions Taken (O5 Operational)
${
  filteredFromDisk.operational.length > 0
    ? filteredFromDisk.operational
        .map(
          (item, i) =>
            `${i + 1}. [Score: ${item.score}/10] ${item.text.substring(0, 150)}${item.text.length > 150 ? '...' : ''}`
        )
        .join('\n\n')
    : '(None)'
}

## Algorithms & Logic (O6 Mathematical)
${
  filteredFromDisk.mathematical.length > 0
    ? filteredFromDisk.mathematical
        .map(
          (item, i) =>
            `${i + 1}. [Score: ${item.score}/10] ${item.text.substring(0, 150)}${item.text.length > 150 ? '...' : ''}`
        )
        .join('\n\n')
    : '(None)'
}

## Conversation Flow (O7 Coherence)
${
  filteredFromDisk.coherence.length > 0
    ? filteredFromDisk.coherence
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

**IMPORTANT**: The recap above shows messages truncated to 150 characters. When you see \`...\` it's a **signal** that more content is available. Use \`recall_past_conversation\` to retrieve the FULL untruncated message. Think of the recap as navigation pointers, not complete verbatim history.
`.trim()
        );
      }
    } catch (err) {
      // Fall back to paradigm shifts method
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
 * Main reconstruction function - intelligently chooses mode and builds context
 *
 * This is the PRIMARY ENTRY POINT for context reconstruction. Analyzes the
 * conversation lattice, classifies the mode (quest vs chat), extracts metrics,
 * and generates an intelligent compressed recap appropriate for the conversation type.
 *
 * THREE-STAGE PIPELINE:
 * 1. **Classification**: Determine conversation mode (quest or chat)
 * 2. **Metrics Calculation**: Extract quality/engagement metrics
 * 3. **Reconstruction**: Build mode-appropriate markdown recap
 *
 * ALGORITHM:
 * 1. Classify conversation mode using classifyConversationMode()
 * 2. Calculate conversation metrics:
 *    - Total nodes (turn count)
 *    - Paradigm shifts (breakthrough moments)
 *    - Tool uses (implementation activity)
 *    - Code blocks (code engagement)
 *    - Average structural score (O1)
 *    - Average operational score (O5)
 * 3. Based on mode:
 *    - Quest: Call reconstructQuestContext()
 *    - Chat: Call reconstructChatContext() with conversationRegistry
 * 4. Return ReconstructedSessionContext with mode, recap, metrics
 *
 * DESIGN:
 * This function orchestrates the entire reconstruction process. It's called
 * when:
 * - Compression threshold reached (50 turns)
 * - Session resume after compression
 * - Manual context reconstruction requested
 *
 * The returned object contains:
 * - **mode**: How the conversation was classified
 * - **recap**: Markdown text to inject as system message
 * - **metrics**: Quantitative measures of conversation quality/type
 *
 * Metrics are useful for:
 * - Logging/analytics (track conversation patterns)
 * - Debugging (understand why classification chose quest vs chat)
 * - Future enhancements (adaptive compression based on metrics)
 *
 * CRITICAL PARAMETER - conversationRegistry:
 * If provided, enables rich overlay-based filtering in chat mode. Without it,
 * chat mode falls back to basic paradigm shift extraction. Always pass this
 * when available for best results.
 *
 * @param lattice - Conversation lattice with nodes, edges, and metadata
 * @param cwd - Current working directory (for system fingerprint)
 * @param conversationRegistry - Optional conversation overlay registry (enables overlay-based filtering)
 * @returns Reconstructed context with mode, markdown recap, and metrics
 *
 * @example
 * // Reconstruct context after compression
 * const lattice = await rebuildLatticeFromLanceDB(sessionId, cwd);
 * const context = await reconstructSessionContext(
 *   lattice,
 *   cwd,
 *   conversationRegistry
 * );
 *
 * console.log(`Session classified as: ${context.mode}`);
 * console.log(`Nodes: ${context.metrics.nodes}`);
 * console.log(`Paradigm shifts: ${context.metrics.paradigm_shifts}`);
 * console.log(`Tool uses: ${context.metrics.tool_uses}`);
 *
 * // Inject recap as system message
 * messages.push({
 *   role: 'system',
 *   content: context.recap
 * });
 *
 * @example
 * // Analyze conversation patterns
 * const context = await reconstructSessionContext(lattice, cwd);
 *
 * if (context.mode === 'quest') {
 *   console.log('Implementation session detected');
 *   console.log(`Avg structural score: ${context.metrics.avg_structural}`);
 *   console.log(`Avg operational score: ${context.metrics.avg_operational}`);
 * } else {
 *   console.log('Discussion session detected');
 * }
 *
 * // Log compression event
 * console.log(`Compressed ${context.metrics.nodes} turns`);
 * console.log(`Found ${context.metrics.paradigm_shifts} paradigm shifts`);
 * console.log(`${context.metrics.tool_uses} tool uses`);
 * console.log(`${context.metrics.code_blocks} code blocks`);
 *
 * @example
 * // Use in compression workflow
 * async function compressSession(sessionId: string, cwd: string) {
 *   // 1. Rebuild lattice from LanceDB
 *   const lattice = await rebuildLatticeFromLanceDB(sessionId, cwd);
 *
 *   // 2. Reconstruct context intelligently
 *   const context = await reconstructSessionContext(
 *     lattice,
 *     cwd,
 *     conversationRegistry
 *   );
 *
 *   // 3. Clear old messages, inject recap
 *   const systemMessage = {
 *     role: 'system',
 *     content: context.recap
 *   };
 *
 *   // 4. Log compression event
 *   await logCompression(sessionId, {
 *     mode: context.mode,
 *     original_turns: context.metrics.nodes,
 *     paradigm_shifts: context.metrics.paradigm_shifts,
 *     compressed_at: Date.now()
 *   });
 *
 *   return systemMessage;
 * }
 */
export async function reconstructSessionContext(
  lattice: ConversationLattice,
  cwd: string,
  conversationRegistry?: ConversationOverlayRegistry
): Promise<ReconstructedSessionContext> {
  console.log(
    '🔍 [RECONSTRUCT DEBUG] Step A: Starting reconstructSessionContext'
  );

  // 1. Classify conversation mode
  const mode = classifyConversationMode(lattice);

  // 2. Calculate metrics
  const nodes = lattice.nodes;
  console.log(
    `🔍 [RECONSTRUCT DEBUG] Step C: Calculating metrics for ${nodes.length} nodes`
  );
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
  console.log(
    `🔍 [RECONSTRUCT DEBUG] Step D: Starting ${mode} mode reconstruction...`
  );
  const recap =
    mode === 'quest'
      ? await reconstructQuestContext(lattice, cwd)
      : await reconstructChatContext(lattice, cwd, conversationRegistry);
  console.log(
    `🔍 [RECONSTRUCT DEBUG] Step E: ${mode} mode reconstruction complete`
  );

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
