import { vi } from 'vitest';

vi.mock('../packages/adapters/src/demo/index.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('../packages/adapters/src/demo/index.ts')>();
  const { setTimeout } = await import('node:timers/promises');
  return {
    ...original,
    demo: original.createDemo({
      // Yield between events and retain aborts without paying the Demo's presentation delays.
      delay: async (_milliseconds, signal) => {
        await setTimeout(0, undefined, { signal });
      },
    }),
  };
});
