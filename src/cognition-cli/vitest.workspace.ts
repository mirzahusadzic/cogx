import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    extends: 'vitest.config.ts',
    test: {
      name: 'main',
    },
  },
  {
    extends: 'vitest.workerpool.config.ts',
    test: {
      name: 'workerpool',
    },
  },
]);
