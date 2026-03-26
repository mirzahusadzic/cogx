import chalk from 'chalk';
import { execa } from 'execa';
import { PGCManager } from '../core/pgc/manager.js';
import { IntentResolver } from '../core/lineage/intent-resolver.js';
import { EGemmaClient } from '../core/lineage/egemma-client.js';
import { WorkbenchClient } from '../core/executors/workbench-client.js';

interface LineageEnrichOptions {
  dryRun: boolean;
  projectRoot: string;
  since?: string;
}

export async function lineageEnrichCommand(options: LineageEnrichOptions) {
  const { projectRoot, dryRun, since } = options;
  const pgc = new PGCManager(projectRoot);

  const workbench = new WorkbenchClient(
    process.env.WORKBENCH_URL || 'http://localhost:8000'
  );
  const egemma = new EGemmaClient(workbench);
  // Always enable synthesis for enrich command
  const intentResolver = new IntentResolver(pgc.intentAdapter, egemma, true);

  try {
    console.log(chalk.bold('💎 Enriching low-confidence transformations...'));

    let allFileKeys = await pgc.index.getAll();

    if (since) {
      console.log(chalk.gray(`Filtering files changed since ${since}...`));
      try {
        const { stdout } = await execa(
          'git',
          ['diff', '--name-only', `${since}...HEAD`],
          {
            cwd: projectRoot,
          }
        );
        const changedFiles = new Set(stdout.split('\n').filter(Boolean));
        allFileKeys = allFileKeys.filter((key) => changedFiles.has(key));
        console.log(
          chalk.gray(`Found ${allFileKeys.length} changed files to scan.`)
        );
      } catch (error) {
        console.warn(
          chalk.yellow(`Could not get git diff: ${error}. Scanning all files.`)
        );
      }
    }

    let enrichedCount = 0;
    let lowConfidenceCount = 0;

    for (const key of allFileKeys) {
      const indexEntry = await pgc.index.get(key);
      if (!indexEntry || !indexEntry.history) continue;

      const newHistory = [...indexEntry.history];
      let historyChanged = false;

      for (let i = 0; i < newHistory.length; i++) {
        const transformId = newHistory[i];

        // Only process 64-char hex strings (transform IDs)
        if (!/^[0-9a-f]{64}$/.test(transformId)) continue;

        const transform = await pgc.transformLog.getTransformation(transformId);

        if (!transform || !transform.reasoning) continue;

        // Skip if confidence is already high
        if ((transform.reasoning.confidence || 0) >= 0.5) continue;

        lowConfidenceCount++;

        if (dryRun) {
          console.log(
            chalk.gray(
              `- [DRY RUN] Would enrich ${indexEntry.path} (transform: ${transformId.slice(0, 8)}, current confidence: ${transform.reasoning.confidence?.toFixed(2)})`
            )
          );
          continue;
        }

        console.log(
          chalk.cyan(
            `Enriching ${indexEntry.path} (transform: ${transformId.slice(0, 8)})...`
          )
        );

        // a. Try to get diff for synthesis
        let diff: string | null = null;
        if (transform.git?.commit_hash) {
          try {
            const { stdout } = await execa(
              'git',
              ['show', transform.git.commit_hash, '--', indexEntry.path],
              { cwd: projectRoot }
            );
            diff = stdout;
          } catch {
            // Ignore diff extraction errors
          }
        }

        // b. Re-resolve intent with synthesis enabled
        const resolved = await intentResolver.resolve(
          indexEntry.path,
          transform.git?.message || transform.reasoning.intent || null,
          diff,
          transform.git || null
        );

        // c. If confidence improved, record new transform and invalidate old one
        if (resolved.confidence > (transform.reasoning.confidence || 0)) {
          const newTransformId = await pgc.transformLog.record({
            ...transform,
            reasoning: {
              ...transform.reasoning,
              intent: resolved.intent,
              decision: resolved.decision,
              alternatives: resolved.alternatives,
              confidence: resolved.confidence,
            },
            source: resolved.source ||
              transform.source || {
                type: 'automated',
                identifier: 'lineage-enrich',
              },
          });

          await pgc.transformLog.invalidate(
            transformId,
            `Enriched via eGemma (new ID: ${newTransformId})`
          );

          newHistory[i] = newTransformId;
          historyChanged = true;
          enrichedCount++;

          console.log(
            chalk.green(
              `  ✓ Improved confidence to ${resolved.confidence.toFixed(2)}`
            )
          );
        } else {
          console.log(
            chalk.yellow('  - No improvement in confidence. Skipping.')
          );
        }
      }

      if (historyChanged && !dryRun) {
        await pgc.index.set(key, {
          ...indexEntry,
          history: newHistory,
        });
      }
    }

    if (dryRun) {
      console.log(
        chalk.bold(
          `\nScan complete. Found ${lowConfidenceCount} candidates for enrichment.`
        )
      );
    } else {
      console.log(
        chalk.bold(
          `\nEnrichment complete. Improved ${enrichedCount} transformations.`
        )
      );
    }
  } catch (error) {
    console.error(
      chalk.red(
        `Error enriching lineage: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    process.exit(1);
  }
}
