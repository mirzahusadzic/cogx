import path from 'node:path';
import chalk from 'chalk';
import { IntentAdapter, IntentRecord } from '../core/lineage/intent-adapter.js';

interface LineageIntentOptions {
  file: string; // Relative or absolute path
  intent: string;
  decision?: string;
  alternatives?: string[];
  source: string;
  session?: string;
  confidence?: string;
  projectRoot: string;
}

/**
 * Declares an intent for a future code transformation.
 * This is the "real-time" path for AI agents to record reasoning BEFORE
 * writing a file.
 *
 * @param options - Intent declaration options
 */
export async function lineageIntentCommand(options: LineageIntentOptions) {
  const { projectRoot, file, intent, decision, alternatives, source, session } =
    options;
  const pgcRoot = path.join(projectRoot, '.open_cognition');

  try {
    const adapter = new IntentAdapter(pgcRoot);

    // Resolve file path to relative from project root
    let relativePath = file;
    if (path.isAbsolute(file)) {
      relativePath = path.relative(projectRoot, file);
    }

    const confidence = parseFloat(options.confidence || '0.95');

    const record: IntentRecord = {
      file_path: relativePath,
      intent,
      decision,
      alternatives,
      source: {
        type: 'ai_agent', // Default for this command
        identifier: source,
        session_id: session,
      },
      confidence,
    };

    const hash = await adapter.recordIntent(record);

    console.log(
      chalk.green(
        `✓ Recorded intent for ${relativePath} (intent hash: ${hash.slice(0, 8)})`
      )
    );
  } catch (error) {
    console.error(
      chalk.red(
        `Error recording intent: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    process.exit(1);
  }
}
