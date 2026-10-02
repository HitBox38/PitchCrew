import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'packages/*/src/**/__tests__/**/*.test.ts'],
    testTimeout: 15000,
  },
});
