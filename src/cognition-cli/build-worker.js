import esbuild from 'esbuild';

esbuild
  .build({
    entryPoints: ['src/core/overlays/lineage/lineage-pattern-worker.ts'],
    bundle: true,
    platform: 'node',
    target: 'node16',
    format: 'cjs',
    outfile: 'dist/worker.cjs',
    packages: 'external',
    logLevel: 'error', // 👈 Only show errors, not warnings
    // Also mark specific internal modules that use import.meta as external
    external: ['./search-worker.js'],
  })
  .then(() => {
    console.log('✓ Worker built successfully');
  })
  .catch(() => process.exit(1));
