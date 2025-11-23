/**
 * Terminal User Interface (TUI) Command
 *
 * Launches an interactive terminal interface for conversational Claude sessions
 * with full Grounded Context Pool (PGC) integration. The TUI provides a rich
 * conversation experience with message history, session persistence, and extended
 * thinking capabilities.
 *
 * FEATURES:
 * - Multi-turn conversations with Claude (via workbench)
 * - Session persistence and resume (.sigma/*.state.json)
 * - Extended thinking mode (up to 32K tokens for complex reasoning)
 * - PGC context injection for overlay-aware responses
 * - AIEcho-branded terminal UI (dark theme: #0d1117)
 * - Keyboard navigation and message scrolling
 *
 * SESSION MANAGEMENT:
 * Sessions are stored in .sigma/ directory with the format:
 * - .sigma/tui-<timestamp>.state.json (new sessions)
 * - Session ID can be provided to resume existing sessions
 * - Each session maintains full message history and context
 *
 * DESIGN:
 * The TUI integrates with the Sigma lattice system for:
 * - Persistent conversation anchors (session IDs)
 * - Message reconstruction from lattice
 * - Extended thinking token budget (maxThinkingTokens)
 * - Debug mode for development and troubleshooting
 *
 * @example
 * // Start fresh Claude session
 * cognition-cli tui
 * // → Creates new session in .sigma/tui-<timestamp>.state.json
 *
 * @example
 * // Resume existing session by ID
 * cognition-cli tui --session-id tui-1762546919034
 * // → Loads conversation history and continues
 *
 * @example
 * // Resume from session file
 * cognition-cli tui -f .sigma/tui-1762546919034.state.json
 * // → Extracts session ID and resumes conversation
 */

import path from 'path';
import { WorkspaceManager } from '../core/workspace-manager.js';
import { startTUI } from '../tui/index.js';

/**
 * Options for the TUI command
 */
interface TUIOptions {
  /** Root directory of the project containing .open_cognition */
  projectRoot: string;
  /** Session ID to resume (e.g., 'tui-1762546919034') */
  sessionId?: string;
  /** Path to session state file (alternative to sessionId) */
  sessionFile?: string;
  /** Workbench URL for Claude API (default: http://localhost:8000) */
  workbenchUrl?: string;
  /** Maximum tokens for the session (not currently used) */
  sessionTokens?: number;
  /** Maximum tokens for extended thinking mode (default: 32000) */
  maxThinkingTokens?: number;
  /** Enable debug mode for troubleshooting */
  debug?: boolean;
  /** LLM provider to use (default: 'claude') */
  provider?: string;
  /** Model to use (provider-specific) */
  model?: string;
  /** Display thinking blocks in TUI (default: true) */
  displayThinking?: boolean;
}

/**
 * Launch interactive TUI with Claude integration
 *
 * Initializes the terminal UI with PGC context and starts a conversational
 * session. Handles session ID resolution from either --session-id or --file,
 * validates PGC workspace existence, and configures the terminal display.
 *
 * TERMINAL SETUP:
 * - Sets background color to AIEcho dark (#0d1117)
 * - Clears screen for clean slate
 * - Configures TTY for interactive input
 *
 * ERROR HANDLING:
 * - Exits with code 1 if no .open_cognition workspace found
 * - Exits with code 1 if both --session-id and --file provided
 *
 * @param options - TUI command options
 *
 * @example
 * // Fresh session with extended thinking
 * await tuiCommand({
 *   projectRoot: '/path/to/project',
 *   maxThinkingTokens: 64000
 * });
 *
 * @example
 * // Resume session with debug mode
 * await tuiCommand({
 *   projectRoot: '/path/to/project',
 *   sessionId: 'tui-1762546919034',
 *   debug: true
 * });
 */
export async function tuiCommand(options: TUIOptions): Promise<void> {
  // Find .open_cognition workspace
  const workspaceManager = new WorkspaceManager();
  const projectRoot = workspaceManager.resolvePgcRoot(options.projectRoot);

  if (!projectRoot) {
    console.error(
      'No .open_cognition workspace found. Run "cognition-cli init" to create one.'
    );
    process.exit(1);
  }

  const pgcRoot = path.join(projectRoot, '.open_cognition');
  const workbenchUrl =
    options.workbenchUrl ||
    process.env.WORKBENCH_URL ||
    'http://localhost:8000';

  // Enable BIDI streaming for Gemini agent workflows
  // BIDI mode keeps the stream alive after tool calls for multi-turn conversations
  if (!process.env.GEMINI_USE_BIDI) {
    process.env.GEMINI_USE_BIDI = '1';
  }

  // Set AIEcho background color: #0d1117 = rgb(13, 17, 23)
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[48;2;13;17;23m'); // Set background to AIEcho dark
    process.stdout.write('\x1b[2J'); // Clear entire screen with new bg
    process.stdout.write('\x1b[H'); // Move cursor to home
  }

  // Resolve session ID from either --session-id or --file
  let sessionId = options.sessionId;

  if (options.sessionFile && options.sessionId) {
    console.error(
      'Error: Cannot specify both --session-id and --file options. Please use one or the other.'
    );
    process.exit(1);
  }

  if (options.sessionFile) {
    // Extract session ID from filename: .sigma/tui-1762546919034.state.json -> tui-1762546919034
    const basename = path.basename(options.sessionFile, '.state.json');
    sessionId = basename;
  }

  // Optional: Resume existing session or start fresh
  if (!sessionId) {
    // Get provider name for the tip message
    const { loadLLMConfig } = await import('../llm/llm-config.js');
    const providerName = options.provider || loadLLMConfig().defaultProvider;
    const providerDisplayName =
      providerName.charAt(0).toUpperCase() + providerName.slice(1);

    console.log(
      `\n💡 Tip: Starting fresh ${providerDisplayName} session. To resume, use:\n` +
        '   cognition-cli tui --session-id <anchor-id>\n' +
        '   or: cognition-cli tui -f .sigma/<session>.state.json\n'
    );
  }

  // Validate provider if specified
  if (options.provider) {
    try {
      const { registry, initializeProviders } = await import('../llm/index.js');
      await initializeProviders();

      if (!registry.has(options.provider)) {
        console.error(
          `Error: Provider '${options.provider}' not found.\n` +
            `Available providers: ${registry.list().join(', ')}`
        );
        process.exit(1);
      }

      // Check if provider supports agent mode
      if (!registry.supportsAgent(options.provider)) {
        console.error(
          `Error: Provider '${options.provider}' does not support agent mode.\n` +
            `Available agent providers: ${registry.listAgentProviders().join(', ')}`
        );
        process.exit(1);
      }
    } catch (error) {
      console.error(
        `Error: Failed to validate provider: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  }

  // Launch TUI
  await startTUI({
    pgcRoot,
    projectRoot,
    sessionId,
    workbenchUrl,
    sessionTokens: options.sessionTokens,
    maxThinkingTokens: options.maxThinkingTokens ?? 32000, // Default: 32K tokens for extended thinking (matches Claude Code)
    debug: options.debug,
    provider: options.provider, // NEW: Pass provider to TUI
    model: options.model, // NEW: Pass model to TUI
    displayThinking: options.displayThinking ?? true,
  });
}
