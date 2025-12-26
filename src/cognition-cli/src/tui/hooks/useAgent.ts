export { useAgent } from './useAgent/index.js';
export type { TUIMessage, UseAgentOptions } from './useAgent/types.js';

/**
 * Agent SDK Integration Hook
 *
 * The central orchestrator for the TUI's agent integration. Manages the complete
 * lifecycle of AI-assisted conversations with Sigma (Σ) conversation lattice,
 * context compression, and semantic memory.
 *
 * ARCHITECTURE:
 * This hook composes several specialized hooks and services:
 *
 * 1. SESSION MANAGEMENT (useSessionManager):
 *    - Dual-identity session model (anchor ID + SDK session ID)
 *    - Session persistence across compressions
 *    - State tracking (.sigma/{session}.state.json)
 *
 * 2. TOKEN TRACKING (useTokenCount):
 *    - Real-time token usage monitoring
 *    - Compression threshold detection
 *    - Proper reset semantics for new sessions
 *
 * 3. TURN ANALYSIS (useTurnAnalysis):
 *    - Background semantic analysis of conversation turns
 *    - Embedding generation and novelty scoring
 *    - Paradigm shift detection
 *    - LanceDB persistence for conversation memory
 *
 * 4. COMPRESSION (useCompression):
 *    - Automatic context compression at token thresholds
 *    - Lattice-based intelligent recap generation
 *    - Session boundary management
 *
 * 5. SIGMA SERVICES:
 *    - EmbeddingService: Vector embeddings via workbench
 *    - ConversationOverlayRegistry: Conversation memory overlays (O1-O7)
 *    - RecallMcpServer: MCP tool for on-demand memory queries
 *    - ContextInjector: Real-time semantic context retrieval
 *
 * DATA FLOW:
 * User Input → Slash Command Expansion → Context Injection → SDK Query
 *   ↓
 * Streaming Response → Message State → Turn Analysis (background)
 *   ↓
 * Token Threshold → Compression → Lattice Recap → New SDK Session
 *   ↓
 * Persistent State → Resume on Restart
 *
 * DESIGN RATIONALE:
 *
 * WHY COMPOSITION OVER MONOLITH?
 * Originally a 1200+ line hook, this was refactored to compose smaller hooks.
 * Benefits:
 * - Testability: Each hook can be tested independently
 * - Reusability: Hooks can be used in other contexts
 * - Clarity: Clear separation of concerns
 * - Maintainability: Easier to understand and modify
 *
 * WHY BACKGROUND TURN ANALYSIS?
 * Turn analysis is CPU-intensive (embeddings, vector search). Running it
 * synchronously would block the UI. The queue-based approach ensures:
 * - Non-blocking conversation flow
 * - Ordered analysis (FIFO queue)
 * - Graceful degradation (analysis can lag without breaking UX)
 *
 * WHY DUAL-IDENTITY SESSIONS?
 * The SDK creates new session UUIDs on compression. Without stable anchor IDs:
 * - Users would lose track of their work
 * - State files would proliferate
 * - No clear audit trail
 * The dual model solves this: anchor ID = user-facing, SDK ID = internal.
 *
 * WHY LATTICE-BASED COMPRESSION?
 * Traditional summarization loses nuance and context. The conversation lattice:
 * - Preserves high-importance turns verbatim
 * - Clusters related concepts
 * - Maintains temporal coherence
 * - Enables semantic queries across history
 *
 * @example
 * // Basic TUI integration
 * const agent = useClaudeAgent({
 *   sessionId: 'my-project',
 *   cwd: process.cwd(),
 *   sessionTokens: 80000,
 *   debug: true
 * });
 *
 * // Send message
 * await agent.sendMessage('Explain the overlay system');
 *
 * // Display messages
 * agent.messages.map(msg => (
 *   <Message type={msg.type} content={msg.content} />
 * ));
 *
 * @example
 * // Monitor Sigma statistics
 * console.log(`Lattice nodes: ${agent.sigmaStats.nodes}`);
 * console.log(`Paradigm shifts: ${agent.sigmaStats.paradigmShifts}`);
 * console.log(`Avg novelty: ${agent.sigmaStats.avgNovelty}`);
 *
 * @example
 * // Handle compression
 * useEffect(() => {
 *   if (agent.tokenCount.total > 80000) {
 *     // Compression will trigger automatically via useCompression
 *     console.log('Approaching compression threshold...');
 *   }
 * }, [agent.tokenCount.total]);
 */

/**
 * Manages Agent SDK integration with Sigma conversation lattice.
 *
 * This is the primary hook for the TUI. It orchestrates:
 * - SDK query lifecycle
 * - Message streaming and display
 * - Token tracking
 * - Turn analysis (background)
 * - Context compression
 * - Session management
 * - Slash command expansion
 * - Semantic context injection
 *
 * LIFECYCLE:
 * 1. Mount:
 *    - Initialize services (embedder, registries, MCP server)
 *    - Load session state (if resuming)
 *    - Load conversation lattice from LanceDB
 *    - Load slash commands from .claude/commands/
 *
 * 2. User Input:
 *    - Expand slash commands (if applicable)
 *    - Inject semantic context from lattice
 *    - Create SDK query with Claude Code preset
 *    - Attach recall MCP server for memory queries
 *
 * 3. Streaming Response:
 *    - Process SDK messages (assistant, tool_use, stream_event)
 *    - Update token counts
 *    - Display tool progress
 *    - Update message state
 *
 * 4. Turn Completion:
 *    - Queue turn for background analysis
 *    - Update overlay scores
 *    - Check compression threshold
 *
 * 5. Compression (if needed):
 *    - Wait for analysis queue to complete
 *    - Build conversation lattice
 *    - Generate intelligent recap
 *    - Create new SDK session
 *    - Update session state
 *
 * 6. Unmount:
 *    - Flush conversation overlays to LanceDB
 *    - Save session state
 *
 * @param options - Configuration for SDK, session, and compression
 * @returns Object with messages, sendMessage, and Sigma statistics
 *
 * @example
 * // Initialize agent
 * const agent = useClaudeAgent({
 *   sessionId: 'my-work',
 *   cwd: '/home/user/project',
 *   sessionTokens: 80000,
 *   debug: true
 * });
 *
 * // Send user message
 * const handleSubmit = async (input: string) => {
 *   await agent.sendMessage(input);
 * };
 *
 * // Interrupt long-running query
 * const handleInterrupt = async () => {
 *   await agent.interrupt();
 * };
 *
 * // Display conversation
 * {agent.messages.map((msg, i) => (
 *   <Box key={i}>
 *     <Text color={msg.type === 'user' ? 'blue' : 'white'}>
 *       {msg.content}
 *     </Text>
 *   </Box>
 * ))}
 */
