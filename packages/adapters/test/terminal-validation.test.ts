import { afterEach, expect, it, vi } from 'vitest';
import { adapters } from '../src/index.ts';
import { cleanup, contextFor } from './helpers/runtime.ts';

afterEach(cleanup);
it('rejects Grok max-turns exhaustion even if the CLI subsequently emits end_turn', async () => {
  await expect(adapters.grok.run(await contextFor('grok', 'max-turns'))).rejects.toThrow(
    'valid structured result',
  );
});

vi.mock('../src/process.ts', () =>
  import('./helpers/runtime-mocks.ts').then((m) => m.processMock()),
);
vi.mock('../src/acp.ts', () => import('./helpers/runtime-mocks.ts').then((m) => m.acpMock()));
