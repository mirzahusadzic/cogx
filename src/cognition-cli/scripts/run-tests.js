import { spawnSync } from 'child_process';

const args = process.argv.slice(2);

/**
 * Sync sleep function
 */
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

if (args.length > 0) {
  // If arguments are provided, run vitest with those arguments.
  // This will use the vitest.workspace.ts to correctly identify which config to use for each file.
  const result = spawnSync('npx', ['vitest', 'run', ...args], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' },
  });
  process.exit(result.status ?? 1);
} else {
  // If no arguments, run the main tests and then the workerpool tests sequentially with a delay.
  console.log('Running main tests...');
  const mainResult = spawnSync('npm', ['run', 'test:main'], {
    stdio: 'inherit',
    shell: true,
  });

  if (mainResult.status !== 0) {
    process.exit(mainResult.status ?? 1);
  }

  console.log('Sleeping 3 seconds before workerpool tests...');
  sleep(3000);

  console.log('Running workerpool tests...');
  const workerpoolResult = spawnSync('npm', ['run', 'test:workerpool'], {
    stdio: 'inherit',
    shell: true,
  });
  process.exit(workerpoolResult.status ?? 1);
}
