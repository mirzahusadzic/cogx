import path from 'path';
import { WorkspaceManager } from '../core/workspace-manager.js';
import { startTUI } from '../tui/index.js';

interface TUIOptions {
  projectRoot: string;
  sessionId?: string;
  workbenchUrl?: string;
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

  // Optional: Resume existing session or start fresh
  if (!options.sessionId) {
    console.log(
      '\n💡 Tip: Starting fresh Claude session. To resume an existing session:\n' +
        '   cognition-cli tui --session-id <uuid>\n'
    );
  }

  // Launch TUI
  await startTUI({
    pgcRoot,
    projectRoot,
    sessionId: options.sessionId,
    workbenchUrl,
  });
}
