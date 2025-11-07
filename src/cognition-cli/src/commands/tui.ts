import path from 'path';
import { WorkspaceManager } from '../core/workspace-manager.js';
import { startTUI } from '../tui/index.js';

interface TUIOptions {
  projectRoot: string;
  sessionId?: string;
  sessionFile?: string;
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
    console.log(
      '\n💡 Tip: Starting fresh Claude session. To resume, use:\n' +
        '   cognition-cli tui --session-id <anchor-id>\n' +
        '   or: cognition-cli tui -f .sigma/<session>.state.json\n'
    );
  }

  // Launch TUI
  await startTUI({
    pgcRoot,
    projectRoot,
    sessionId,
    workbenchUrl,
    sessionTokens: options.sessionTokens,
    debug: options.debug,
  });
}
