import path from 'path';
import { WorkspaceManager } from '../core/workspace-manager.js';
import { startTUI } from '../tui/index.js';
import { resolveAlias } from '../sigma/session-state.js';

interface TUIOptions {
  projectRoot: string;
  sessionId?: string;
  alias?: string;
  workbenchUrl?: string;
  sessionTokens?: number;
  debug?: boolean;
}

/**
 * Launch interactive TUI with Claude integration
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

  // Resolve alias to session ID if provided
  let sessionId = options.sessionId;

  if (options.alias) {
    if (options.sessionId) {
      console.error('❌ Cannot use both --session-id and --alias together');
      process.exit(1);
    }

    try {
      const resolved = resolveAlias(options.alias, projectRoot);
      if (!resolved) {
        console.error(`❌ No session found with alias: ${options.alias}`);
        process.exit(1);
      }
      sessionId = resolved;
      console.log(`🔗 Resolved alias "${options.alias}" → ${sessionId}`);
    } catch (err) {
      console.error(`❌ ${(err as Error).message}`);
      process.exit(1);
    }
  }

  const pgcRoot = path.join(projectRoot, '.open_cognition');
  const workbenchUrl =
    options.workbenchUrl ||
    process.env.WORKBENCH_URL ||
    'http://localhost:8000';

  // Set AIEcho background color: #0d1117 = rgb(13, 17, 23)
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[48;2;13;17;23m'); // Set background to AIEcho dark
    process.stdout.write('\x1b[2J'); // Clear entire screen with new bg
    process.stdout.write('\x1b[H'); // Move cursor to home
  }

  // Optional: Resume existing session or start fresh
  if (!sessionId) {
    console.log(
      '\n💡 Tip: Starting fresh Claude session. To resume:\n' +
        '   cognition-cli tui --session-id <uuid>\n' +
        '   cognition-cli tui --alias <name>\n'
    );
  }

  // Launch TUI
  await startTUI({
    pgcRoot,
    projectRoot,
    sessionId: sessionId, // Use resolved sessionId from alias if provided
    workbenchUrl,
    sessionTokens: options.sessionTokens,
    debug: options.debug,
  });
}
