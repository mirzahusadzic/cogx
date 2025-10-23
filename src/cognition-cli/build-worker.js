import esbuild from 'esbuild';

// Build lineage worker
await esbuild.build({
  entryPoints: ['src/core/overlays/lineage/lineage-pattern-worker.ts'],
  bundle: true,
  platform: 'node',
  target: 'node16',
  format: 'cjs',
  outfile: 'dist/lineage-worker.cjs',
  packages: 'external',
  logLevel: 'error',
  external: ['./search-worker.js'],
});

// Build structural worker
await esbuild.build({
  entryPoints: ['src/core/overlays/structural/structural-pattern-worker.ts'],
  bundle: true,
  platform: 'node',
  target: 'node16',
  format: 'cjs',
  outfile: 'dist/structural-worker.cjs',
  packages: 'external',
  logLevel: 'error',
  external: ['./search-worker.js'],
});

// Build genesis worker
await esbuild.build({
  entryPoints: ['src/core/orchestrators/genesis-worker.ts'],
  bundle: true,
  platform: 'node',
  target: 'node16',
  format: 'cjs',
  outfile: 'dist/genesis-worker.cjs',
  packages: 'external',
  logLevel: 'error',
  external: ['./search-worker.js'],
});

console.log('✓ Workers built successfully');
