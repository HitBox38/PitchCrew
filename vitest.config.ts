import { configDefaults, defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    // Browser and bounded-worker fixtures share host resources; match the CI default.
    // Developers can opt into more parallelism with --maxWorkers.
    maxWorkers: 2,
    setupFiles: ['./scripts/test-setup.ts'],
    testTimeout: 15000,
    projects: [
      {
        test: {
          name: 'unit-and-api',
          include: ['packages/*/test/**/*.test.ts', 'packages/*/src/**/__tests__/**/*.test.ts'],
          exclude: [...configDefaults.exclude, 'packages/ui/test/**'],
        },
      },
      {
        test: {
          name: 'ui',
          include: ['packages/ui/test/**/*.test.ts'],
          globalSetup: ['./packages/ui/test/global-setup.ts'],
        },
      },
    ],
  },
});
