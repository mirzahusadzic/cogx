import chalk from 'chalk';
import { intro, outro, spinner as clackSpinner } from '@clack/prompts';
import { createQueryEngine } from '../../core/algebra/query-parser.js';
import { SugarCommandConfig, SugarCommandOptions } from './types.js';
import {
  displayItemList,
  displayMeetResults,
  resolvePgcRoot,
} from './utils.js';

/**
 * Higher-order function to create a "sugar" command.
 *
 * Sugar commands wrap the lattice algebra query language with named commands
 * that are easier to remember and use. This factory handles:
 * 1. PGC root resolution
 * 2. Query Engine initialization
 * 3. Query construction (custom or metadata-driven)
 * 4. UI management (spinners, success/fail messages)
 * 5. Format-aware output (JSON vs human-readable)
 *
 * @param config - Metadata-driven configuration for the command
 * @returns An async function that executes the command
 */
export function createSugarCommand(config: SugarCommandConfig) {
  return async (options: SugarCommandOptions) => {
    const useJson =
      options.format === 'json' || process.env.COGNITION_FORMAT === 'json';

    if (!useJson) {
      intro(chalk.bold(config.name));
    }

    const pgcRoot = resolvePgcRoot(options.projectRoot || '.');
    const s = clackSpinner();

    if (!useJson) {
      s.start(config.description);
    }

    try {
      if (config.customHandler) {
        await config.customHandler(options);

        if (!useJson) {
          s.stop();
          outro(chalk.green(`✓ ${config.pluralItemLabel} analysis complete`));
        }
        return;
      }

      const workbenchUrl = process.env.WORKBENCH_URL || 'http://localhost:8000';
      const engine = createQueryEngine(pgcRoot, workbenchUrl);

      // Determine query: customQuery > overlay[type] > overlay
      let query = config.customQuery;
      if (!query) {
        if (options.type || config.queryType) {
          query = `${config.overlayType}[${options.type || config.queryType}]`;
        } else {
          query = config.overlayType;
        }
      }

      const result = await engine.execute(query);

      if (!useJson) {
        s.stop(`Analysis of ${config.pluralItemLabel} complete.`);
      }

      // Check if it's a meet result (contains itemA and itemB)
      const isMeetResult =
        Array.isArray(result) &&
        result.length > 0 &&
        result[0] &&
        'itemA' in result[0] &&
        'itemB' in result[0];

      if (isMeetResult) {
        displayMeetResults(result, config.pluralItemLabel, {
          ...options,
          scoreField: config.scoreField,
        });
      } else {
        displayItemList(result, config.pluralItemLabel, {
          ...options,
          scoreField: config.scoreField,
        });
      }

      if (!useJson) {
        outro(chalk.green(`✓ ${config.pluralItemLabel} analysis complete`));
      }
    } catch (error) {
      if (!useJson) {
        s.stop(
          `Failed to analyze ${config.pluralItemLabel}: ${(error as Error).message}`
        );
      }
      if (options.verbose) {
        console.error(error);
      }
      process.exit(1);
    }
  };
}
