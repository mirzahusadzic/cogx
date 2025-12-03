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
import fs from 'fs';
import chalk from 'chalk';
import { WorkspaceManager } from '../core/workspace-manager.js';
import { startTUI } from '../tui/index.js';
import {
  checkPrerequisites,
  type LLMProviderType,
} from '../utils/workbench-detect.js';

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
  /** Skip onboarding wizard even if workspace is incomplete (default: false) */
  noOnboarding?: boolean;
  /** Auto-respond to agent messages without user input (default: true) */
  autoResponse?: boolean;
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
  const resolvedProjectRoot = workspaceManager.resolvePgcRoot(
    options.projectRoot
  );

  // Determine if we're in onboarding mode
  // Onboarding triggers if:
  // 1. No .open_cognition exists at all, OR
  // 2. .open_cognition exists but is incomplete (no genesis or missing critical overlays)
  // User can opt-out with --no-onboarding flag
  let onboardingMode = false;
  let projectRoot: string;
  let pgcRoot: string;

  if (!resolvedProjectRoot) {
    // No workspace found at all
    if (options.noOnboarding) {
      console.error(
        '\n⚠️  No .open_cognition workspace found. Run `cognition init` first.\n'
      );
      process.exit(1);
    }

    // Check if we can enter onboarding mode
    const preferredProvider = options.provider as LLMProviderType | undefined;
    const prerequisites = await checkPrerequisites(preferredProvider);

    if (!prerequisites.allMet) {
      // Prerequisites not met - show helpful error
      console.error('\n⚠️  Cannot start TUI - missing prerequisites:\n');
      prerequisites.errors.forEach((err) => console.error(`  ✗ ${err}`));
      console.error(
        '\nTo use the TUI, ensure workbench is running and an LLM provider is configured.\n'
      );
      process.exit(1);
    }

    // Prerequisites met - enter onboarding mode
    onboardingMode = true;
    projectRoot = options.projectRoot;
    pgcRoot = path.join(projectRoot, '.open_cognition');

    console.log(
      chalk.dim('\n🧙 No workspace detected. Starting onboarding wizard...\n')
    );
    console.log(chalk.dim(`  ✓ Workbench: ${prerequisites.workbench.url}`));
    console.log(chalk.dim(`  ✓ LLM Provider: ${prerequisites.llm.provider}\n`));
  } else {
    // Workspace exists - check if it's incomplete (missing genesis or overlays)
    projectRoot = resolvedProjectRoot;
    pgcRoot = path.join(projectRoot, '.open_cognition');

    // Check if genesis has been run (index/ directory with JSON files)
    const hasGenesis = (() => {
      const indexPath = path.join(pgcRoot, 'index');
      try {
        if (!fs.existsSync(indexPath)) return false;
        const files = fs.readdirSync(indexPath);
        return files.some((f) => f.endsWith('.json'));
      } catch {
        return false;
      }
    })();

    // Check if strategic docs exist
    const hasDocs = (() => {
      // Check if mission_concepts overlay exists (indicates docs ingested)
      const missionPath = path.join(pgcRoot, 'overlays', 'mission_concepts');
      if (fs.existsSync(missionPath)) {
        try {
          const files = fs.readdirSync(missionPath);
          if (files.some((f) => f.endsWith('.yaml'))) return true;
        } catch {
          // Fall through to check docs directory
        }
      }

      // Check if docs directory has VISION.md
      const docsPath = path.join(projectRoot, 'docs');
      if (fs.existsSync(docsPath)) {
        const visionPath = path.join(docsPath, 'VISION.md');
        if (fs.existsSync(visionPath)) return true;
      }

      return false;
    })();

    // Check if critical overlays are missing
    const missingOverlays = (() => {
      const overlayDirs: Record<string, string> = {
        O1: 'structural_patterns',
        O2: 'security_guidelines',
        O3: 'lineage_patterns',
        O4: 'mission_concepts',
        O5: 'operational_patterns',
        O6: 'mathematical_proofs',
        O7: 'strategic_coherence',
      };

      const missing: string[] = [];
      const overlaysRoot = path.join(pgcRoot, 'overlays');

      for (const [code, dirName] of Object.entries(overlayDirs)) {
        const overlayDir = path.join(overlaysRoot, dirName);
        try {
          if (!fs.existsSync(overlayDir)) {
            missing.push(code);
            continue;
          }

          // Check if overlay has content (YAML or JSON files, or manifest)
          const files = fs.readdirSync(overlayDir);
          const hasContent =
            files.some((f) => f.endsWith('.json') || f.endsWith('.yaml')) ||
            files.includes('manifest.json');

          if (!hasContent) {
            missing.push(code);
          }
        } catch {
          missing.push(code);
        }
      }

      return missing;
    })();

    // If genesis, docs, or overlays are missing and user hasn't opted out, enter onboarding mode
    if (!hasGenesis && !options.noOnboarding) {
      console.log(
        chalk.dim(
          '\n🧙 Incomplete workspace detected (no genesis). Starting onboarding wizard...\n'
        )
      );
      onboardingMode = true;
    } else if (hasGenesis && !hasDocs && !options.noOnboarding) {
      console.log(
        chalk.dim(
          '\n🧙 Incomplete workspace detected (no strategic docs). Starting onboarding wizard...\n'
        )
      );
      onboardingMode = true;
    } else if (
      hasGenesis &&
      hasDocs &&
      missingOverlays.length > 0 &&
      !options.noOnboarding
    ) {
      console.log(
        chalk.dim(
          `\n🧙 Incomplete workspace detected (missing ${missingOverlays.length} overlays: ${missingOverlays.join(', ')}). Starting onboarding wizard...\n`
        )
      );
      onboardingMode = true;
    }
  }

  const workbenchUrl =
    options.workbenchUrl ||
    process.env.WORKBENCH_URL ||
    'http://localhost:8000';

  // Enable BIDI streaming for Gemini agent workflows
  // BIDI mode keeps the stream alive after tool calls for multi-turn conversations
  if (!process.env.GEMINI_USE_BIDI) {
    process.env.GEMINI_USE_BIDI = '1';
  }

  // Skip background color setting - let terminal inherit its own background
  // Only clear screen if not in onboarding mode (onboarding is a short wizard)
  if (process.stdout.isTTY && !onboardingMode) {
    process.stdout.write('\x1b[2J'); // Clear entire screen
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

  // Resolve provider and model defaults
  const { loadLLMConfig } = await import('../llm/llm-config.js');
  const llmConfig = loadLLMConfig();
  const resolvedProvider = options.provider || llmConfig.defaultProvider;
  const resolvedModel =
    options.model ||
    llmConfig.providers[resolvedProvider as 'claude' | 'gemini']?.defaultModel;

  // Optional: Resume existing session or start fresh
  if (!sessionId) {
    const providerDisplayName =
      resolvedProvider.charAt(0).toUpperCase() + resolvedProvider.slice(1);

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

  // Set default sessionTokens based on provider
  // Gemini has 2M token context (gemini-2.5-pro) / 1M (gemini-3-pro)
  // Claude has 200K token context (Sonnet/Opus) - compress at 120K to leave buffer
  const defaultSessionTokens = resolvedProvider === 'gemini' ? 950000 : 120000;

  // Launch TUI
  await startTUI({
    pgcRoot,
    projectRoot,
    sessionId,
    workbenchUrl,
    sessionTokens: options.sessionTokens ?? defaultSessionTokens,
    maxThinkingTokens: options.maxThinkingTokens ?? 32000, // Default: 32K tokens for extended thinking (matches Claude Code)
    debug: options.debug,
    provider: resolvedProvider,
    model: resolvedModel,
    displayThinking: options.displayThinking ?? true,
    onboardingMode, // NEW: Pass onboarding mode to TUI
    autoResponse: options.autoResponse ?? true, // Auto-respond to agent messages
  });
}
