#!/usr/bin/env tsx
import { execSync } from 'child_process';
import chalk from 'chalk';

const THRESHOLD = 0.85;

// Helper to run CLI commands and parse JSON
function runCmd(cmd: string) {
  try {
    const output = execSync(cmd, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large lists
    });
    return JSON.parse(output);
  } catch (e) {
    return null;
  }
}

async function main() {
  console.log(chalk.bold.blue('\n🔍 Architectural Similarity Analysis\n'));

  const CLI = 'node dist/cli.js';

  console.log(chalk.dim('Fetching all structural patterns...'));
  const symbols = runCmd(`${CLI} patterns list --json`);

  if (!symbols || !Array.isArray(symbols)) {
    console.error(
      chalk.red(
        '❌ Failed to fetch symbols. Ensure the project is built and patterns exist.'
      )
    );
    return;
  }

  const pairs = new Map<string, any>();
  const total = symbols.length;

  console.log(
    chalk.cyan(`Analyzing ${total} symbols for similarity > ${THRESHOLD}...\n`)
  );

  for (let i = 0; i < total; i++) {
    const s = symbols[i];
    const name = s.metadata.symbolName;

    // Progress indicator
    process.stdout.write(
      `\r[${i + 1}/${total}] Inspecting ${chalk.yellow(name.padEnd(30))} `
    );

    // Find top 5 similar patterns for this symbol
    const similar = runCmd(
      `${CLI} patterns find-similar ${name} --json --top-k 5`
    );

    if (similar && Array.isArray(similar)) {
      for (const sim of similar) {
        const simName = sim.metadata.symbolName;
        const score = sim.metadata.similarity;

        if (score > THRESHOLD && simName !== name) {
          // Sort names to create a unique key for the pair
          const pairKey = [name, simName].sort().join(' <-> ');

          if (!pairs.has(pairKey)) {
            pairs.set(pairKey, {
              symbolA: name,
              symbolB: simName,
              similarity: score,
              role: sim.metadata.role,
              filePathA: s.metadata.filePath,
              filePathB: sim.metadata.filePath,
            });
          }
        }
      }
    }
  }

  console.log('\n\n' + chalk.bold.green('✨ High Similarity Results:'));

  const results = Array.from(pairs.values()).sort(
    (a, b) => b.similarity - a.similarity
  );

  if (results.length === 0) {
    console.log(chalk.dim('No high-similarity pairs found.'));
    return;
  }

  for (const res of results) {
    console.log(
      `\n🤝 ${chalk.bold.cyan(res.symbolA)} <-> ${chalk.bold.green(res.symbolB)}`
    );
    console.log(
      `   ${chalk.yellow('Similarity:')} ${(res.similarity * 100).toFixed(1)}%`
    );
    console.log(`   ${chalk.yellow('Role:')}       ${res.role}`);
    console.log(
      `   ${chalk.yellow('Files:')}      ${chalk.dim(res.filePathA)}`
    );
    console.log(`                ${chalk.dim(res.filePathB)}`);

    // Get blast radius for impact analysis
    const brA = runCmd(`${CLI} blast-radius ${res.symbolA} --json`);
    const brB = runCmd(`${CLI} blast-radius ${res.symbolB} --json`);

    if (brA && brB) {
      const impactA = brA.metrics.totalImpacted;
      const impactB = brB.metrics.totalImpacted;
      console.log(
        `   ${chalk.yellow('Impact:')}     ${res.symbolA} (${impactA}) vs ${res.symbolB} (${impactB})`
      );

      if (impactA > 20 && impactB > 20 && res.similarity > 0.95) {
        console.log(
          chalk.red.bold(
            '   ⚠️  CRITICAL DUPLICATION RISK: Both have high impact and high similarity!'
          )
        );
      }
    }
  }

  console.log('\n' + chalk.blue('Done.') + '\n');
}

main().catch(console.error);
