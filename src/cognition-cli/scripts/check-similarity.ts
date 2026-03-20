#!/usr/bin/env tsx
import { execSync } from 'child_process';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

const DEFAULT_THRESHOLD = 0.95;
const ALLOW_LIST_PATH = path.join(process.cwd(), '.similarity-allowlist.json');

// Helper to run CLI commands and parse JSON
function runCmd(cmd: string) {
  try {
    const output = execSync(cmd, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer
    });
    return JSON.parse(output);
  } catch (e) {
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const threshold = parseFloat(
    args.find((arg) => arg.startsWith('--threshold='))?.split('=')[1] ||
      DEFAULT_THRESHOLD.toString()
  );
  const updateAllowlist = args.includes('--update-allowlist');

  console.log(chalk.bold.blue('\n🔍 CI Architectural Similarity Check\n'));
  console.log(`${chalk.dim('Threshold:')} ${threshold}`);

  const CLI = 'node dist/cli.js';

  console.log(chalk.dim('Analyzing duplicates...'));
  const results = runCmd(
    `${CLI} patterns analyze-duplicates --threshold ${threshold} --json`
  );

  if (!results || !Array.isArray(results)) {
    console.error(
      chalk.red(
        '❌ Failed to analyze duplicates. Ensure the project is built and patterns exist.'
      )
    );
    process.exit(1);
  }

  let allowList: string[] = [];
  if (fs.existsSync(ALLOW_LIST_PATH)) {
    allowList = JSON.parse(fs.readFileSync(ALLOW_LIST_PATH, 'utf-8'));
  }

  const newDuplicates = results.filter((res) => {
    const pairKey = [res.symbolA, res.symbolB].sort().join(' <-> ');
    return !allowList.includes(pairKey);
  });

  if (updateAllowlist) {
    const allPairs = results.map((res) =>
      [res.symbolA, res.symbolB].sort().join(' <-> ')
    );
    fs.writeFileSync(
      ALLOW_LIST_PATH,
      JSON.stringify(Array.from(new Set(allPairs)).sort(), null, 2)
    );
    console.log(
      chalk.green(
        `✅ Allow-list updated with ${allPairs.length} pairs in ${ALLOW_LIST_PATH}`
      )
    );
    return;
  }

  if (newDuplicates.length === 0) {
    console.log(chalk.green('✅ No new high-similarity pairs found.'));
    process.exit(0);
  }

  console.log(
    chalk.red(
      `❌ Found ${newDuplicates.length} new high-similarity pairs above ${threshold}:\n`
    )
  );

  for (const res of newDuplicates) {
    console.log(
      `🤝 ${chalk.bold.cyan(res.symbolA)} <-> ${chalk.bold.green(res.symbolB)}`
    );
    console.log(
      `   ${chalk.yellow('Similarity:')} ${(res.similarity * 100).toFixed(1)}%`
    );
    console.log(`   ${chalk.yellow('Role:')}       ${res.role}`);
    console.log(
      `   ${chalk.yellow('Files:')}      ${chalk.dim(res.filePathA)}`
    );
    console.log(`                ${chalk.dim(res.filePathB)}`);
    console.log();
  }

  console.log(chalk.dim('To allow these pairs, run:'));
  console.log(
    chalk.cyan(
      `  npm run check:similarity -- --update-allowlist --threshold=${threshold}\n`
    )
  );

  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
