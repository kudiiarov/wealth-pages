import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/wealth-pages/' : '/',
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
  },
});
