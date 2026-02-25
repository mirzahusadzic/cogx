// NOTE: SDK silencing (OPENAI_AGENTS_DISABLE_TRACING, console overrides)
// is now handled in cli.ts entry point to ensure it runs before any imports.

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
 * - .sigma/tui-<modelShortName>-<timestamp>.state.json (new sessions)
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
 * // → Creates new session in .sigma/tui-sonnet45-1762546919034.state.json
 *
 * @example
 * // Resume existing session by ID
 * cognition-cli tui --session-id tui-opus45-1762546919034
 * // → Loads conversation history and continues
 *
 * @example
 * // Resume from session file
 * cognition-cli tui -f .sigma/tui-sonnet45-1762546919034.state.json
 * // → Extracts session ID and resumes conversation
 */

import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { WorkspaceManager } from '../core/workspace-manager.js';
import { startTUI } from '../tui/index.js';
import {
  checkPrerequisites,
  autoConfigureOpenAIFromWorkbench,
  checkWorkbenchHealthDetailed,
  type LLMProviderType,
  type WorkbenchHealthResult,
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
  /** Operation mode for token optimization */
  solo?: boolean;
  /** Task log eviction threshold */
  ctxTools: number;
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
 * - Sets background color to AIEcho dark (#0d131c)
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

  // Workbench URL and cached health result (computed once, reused everywhere)
  const workbenchUrl =
    options.workbenchUrl ||
    process.env.WORKBENCH_URL ||
    'http://localhost:8000';
  let cachedHealthResult: WorkbenchHealthResult | null = null;

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

    // Do ONE health check early - reuse for onboarding decision AND pass to TUI
    cachedHealthResult = await checkWorkbenchHealthDetailed(workbenchUrl, true);

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
    // BUT only if workbench is available (onboarding requires workbench for genesis/overlays)
    const needsOnboarding =
      (!hasGenesis || !hasDocs || missingOverlays.length > 0) &&
      !options.noOnboarding;

    if (needsOnboarding && cachedHealthResult) {
      // Use cached health check result (already done above)
      const workbenchFullyHealthy =
        cachedHealthResult.reachable &&
        cachedHealthResult.embeddingReady &&
        cachedHealthResult.summarizationReady;

      if (!workbenchFullyHealthy) {
        // Workbench not fully configured - skip onboarding silently (status bar will show issues)
        // User can still use TUI in basic mode without lattice features
      } else if (!hasGenesis) {
        console.log(
          chalk.dim(
            '\n🧙 Incomplete workspace detected (no genesis). Starting onboarding wizard...\n'
          )
        );
        onboardingMode = true;
      } else if (!hasDocs) {
        console.log(
          chalk.dim(
            '\n🧙 Incomplete workspace detected (no strategic docs). Starting onboarding wizard...\n'
          )
        );
        onboardingMode = true;
      } else if (missingOverlays.length > 0) {
        console.log(
          chalk.dim(
            `\n🧙 Incomplete workspace detected (missing ${missingOverlays.length} overlays: ${missingOverlays.join(', ')}). Starting onboarding wizard...\n`
          )
        );
        onboardingMode = true;
      }
    }
  }

  // Enable BIDI streaming for Gemini agent workflows
  // BIDI mode keeps the stream alive after tool calls for multi-turn conversations
  if (!process.env.GEMINI_USE_BIDI) {
    process.env.GEMINI_USE_BIDI = '1';
  }

  // Clear screen for a clean slate
  // Only clear screen if not in onboarding mode (onboarding is a short wizard)
  if (
    process.stdout.isTTY &&
    !onboardingMode &&
    process.env.NODE_ENV !== 'test'
  ) {
    // Set background color to AIEcho dark (#0d131c) before clearing
    // to ensure the entire terminal (including margins) matches the TUI theme
    process.stdout.write('\x1b]11;#0d131c\x07');
    process.stdout.write('\x1b[48;2;13;19;28m');
    process.stdout.write('\x1b[2J'); // Clear visible screen
    process.stdout.write('\x1b[3J'); // Clear scrollback buffer
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

  // Variables to hold provider/model from state file (for backward-compatible resume)
  let stateProvider: string | undefined;
  let stateModel: string | undefined;

  if (options.sessionFile) {
    // Extract session ID from filename: .sigma/tui-1762546919034.state.json -> tui-1762546919034
    const basename = path.basename(options.sessionFile, '.state.json');
    sessionId = basename;

    // Try to load provider/model from state file for backward-compatible resume
    const stateFilePath = options.sessionFile.startsWith('/')
      ? options.sessionFile
      : path.join(projectRoot, options.sessionFile);

    if (fs.existsSync(stateFilePath)) {
      try {
        const stateContent = JSON.parse(
          fs.readFileSync(stateFilePath, 'utf-8')
        );
        stateProvider = stateContent.provider;
        stateModel = stateContent.model;
      } catch {
        // Ignore parse errors - will use defaults
      }
    }
  }

  // Resolve provider and model defaults
  // When resuming from state file, state provider takes precedence (can't switch providers mid-session)
  // For new sessions: CLI flags > config defaults
  const { loadLLMConfig } = await import('../llm/llm-config.js');
  const llmConfig = loadLLMConfig();

  let resolvedProvider: string;
  if (stateProvider) {
    // Resuming session - must use the provider the session was created with
    resolvedProvider = stateProvider;
    if (options.provider && options.provider !== stateProvider) {
      console.warn(
        chalk.yellow(
          `⚠️  Ignoring --provider ${options.provider}: session was created with ${stateProvider}`
        )
      );
    }
  } else {
    // New session - use CLI flag or config default
    resolvedProvider = options.provider || llmConfig.defaultProvider;
  }

  // Validate and resolve provider
  // Must check resolvedProvider (not just options.provider) because it may come from state file
  let validatedProvider = resolvedProvider;
  let resolvedModel: string | undefined;
  try {
    // Auto-configure OpenAI from workbench if gpt-oss model is available
    // Must happen BEFORE resolvedModel computation so COGNITION_OPENAI_MODEL is set
    // Pass cached health to avoid redundant /health call
    const openaiAutoConfig = await autoConfigureOpenAIFromWorkbench(undefined, {
      workbenchUrl,
      cachedHealth: cachedHealthResult,
    });

    const { registry, initializeProviders } = await import('../llm/index.js');
    // Pass resolvedProvider as default to avoid "gemini not available" warning
    // when loading from file that uses claude/opus
    await initializeProviders({ defaultProvider: resolvedProvider });

    // Resolve model AFTER auto-config so COGNITION_OPENAI_MODEL is available for OpenAI
    resolvedModel =
      options.model ||
      stateModel ||
      (resolvedProvider === 'openai'
        ? process.env.COGNITION_OPENAI_MODEL
        : resolvedProvider === 'minimax'
          ? process.env.COGNITION_MINIMAX_MODEL
          : llmConfig.providers[
              resolvedProvider as 'claude' | 'gemini' | 'minimax'
            ]?.defaultModel);

    if (!registry.has(resolvedProvider)) {
      const availableProviders = registry.list();

      // If loading from state file, abort - can't switch providers mid-session
      if (stateProvider) {
        console.error(
          chalk.red(
            `Error: Cannot resume session - provider '${stateProvider}' is not available.\n`
          ) +
            `The session was created with ${stateProvider} but that provider is not configured.\n` +
            (availableProviders.length > 0
              ? `Available providers: ${availableProviders.join(', ')}\n` +
                `To start a new session with an available provider, omit the -f flag.`
              : `Configure ANTHROPIC_API_KEY, GEMINI_API_KEY, or GOOGLE_GENAI_USE_VERTEXAI to enable a provider.`)
        );
        process.exit(1);
      }

      // If user explicitly specified provider via CLI, error out with helpful message
      if (options.provider) {
        // Special handling for OpenAI - explain workbench requirement
        if (options.provider === 'openai' && !openaiAutoConfig.configured) {
          console.error(
            chalk.red(`\nError: OpenAI provider not available.\n\n`) +
              `Reason: ${openaiAutoConfig.reason || 'Workbench chat model not loaded'}\n\n` +
              `To use the OpenAI provider, either:\n` +
              `  1. Start workbench with a chat model (gpt-oss-20b, etc.)\n` +
              `  2. Set OPENAI_API_KEY and optionally OPENAI_BASE_URL\n` +
              (availableProviders.length > 0
                ? `\nAvailable providers: ${availableProviders.join(', ')}`
                : '')
          );
        } else {
          console.error(
            `Error: Provider '${options.provider}' not found.\n` +
              `Available providers: ${availableProviders.join(', ')}`
          );
        }
        process.exit(1);
      }

      // New session with config default not available - fall back silently
      if (availableProviders.length === 0) {
        console.error(
          'Error: No LLM providers available. Configure ANTHROPIC_API_KEY, GEMINI_API_KEY, GOOGLE_GENAI_USE_VERTEXAI, or start workbench with a chat model.'
        );
        process.exit(1);
      }

      validatedProvider = availableProviders[0];
    }

    // Check if provider supports agent mode
    if (!registry.supportsAgent(validatedProvider)) {
      console.error(
        `Error: Provider '${validatedProvider}' does not support agent mode.\n` +
          `Available agent providers: ${registry.listAgentProviders().join(', ')}`
      );
      process.exit(1);
    }

    // CRITICAL: If provider changed during validation (fallback), recompute model
    // This prevents mismatched provider/model pairs (e.g., claude provider with gemini model)
    if (validatedProvider !== resolvedProvider) {
      // Provider changed - need to use the validated provider's default model
      resolvedModel =
        validatedProvider === 'openai'
          ? process.env.COGNITION_OPENAI_MODEL
          : validatedProvider === 'minimax'
            ? process.env.COGNITION_MINIMAX_MODEL
            : llmConfig.providers[
                validatedProvider as 'claude' | 'gemini' | 'minimax'
              ]?.defaultModel;
    }
  } catch (error) {
    console.error(
      `Error: Failed to validate provider: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }

  // Set default sessionTokens based on provider
  // All cloud providers (Gemini, Claude, OpenAI, Minimax) now default to 200k
  // OpenAI/local models use COGNITION_OPENAI_MAX_TOKENS (auto-configured from workbench health)
  let defaultSessionTokens: number;
  if (
    validatedProvider === 'gemini' ||
    validatedProvider === 'minimax' ||
    validatedProvider === 'claude'
  ) {
    defaultSessionTokens = 200000;
  } else if (validatedProvider === 'openai') {
    // Use auto-configured token limit from workbench
    // Fallback: 200k for official OpenAI (GPT-4o has 128k, but o1 has much more), 4K for unknown local endpoints
    const isLocalEndpoint =
      process.env.OPENAI_BASE_URL &&
      !process.env.OPENAI_BASE_URL.includes('api.openai.com');
    const defaultFallback = isLocalEndpoint ? 4096 : 200000;
    const openaiMaxTokens = process.env.COGNITION_OPENAI_MAX_TOKENS
      ? parseInt(process.env.COGNITION_OPENAI_MAX_TOKENS, 10)
      : defaultFallback;
    defaultSessionTokens = openaiMaxTokens;
  } else {
    // Default fallback
    defaultSessionTokens = 200000;
  }

  // Launch TUI
  await startTUI({
    pgcRoot,
    projectRoot,
    sessionId,
    workbenchUrl,
    sessionTokens: options.sessionTokens ?? defaultSessionTokens,
    maxThinkingTokens: options.maxThinkingTokens ?? 32000, // Default: 32K tokens for extended thinking (matches Claude Code)
    debug: options.debug,
    provider: validatedProvider,
    model: resolvedModel,
    solo: options.solo,
    taskLogEvictionThreshold: options.ctxTools,
    displayThinking: options.displayThinking ?? true,
    onboardingMode, // NEW: Pass onboarding mode to TUI
    autoResponse: options.autoResponse ?? true, // Auto-respond to agent messages
    workbenchHealth: cachedHealthResult, // Pre-computed health (avoids 3 redundant /health calls)
  });
}
