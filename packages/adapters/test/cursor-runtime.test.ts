import { afterEach, describe, expect, it, vi } from 'vitest';
import { adapters } from '../src/index.ts';
import { detectCli, runCliText } from '../src/process.ts';
import { cleanup, contextFor } from './helpers/runtime.ts';

afterEach(cleanup);
describe('Cursor completion and isolation', () => {
  it('reports an installed but unsupported CLI as unavailable with upgrade instructions', async () => {
    vi.mocked(detectCli).mockResolvedValueOnce({
      id: 'cursor-agent',
      available: true,
      version: '2026.07.17-fixture',
      detail: '',
    });
    expect(await adapters['cursor-agent'].detect()).toMatchObject({
      available: false,
      detail: expect.stringContaining('Upgrade cursor-agent'),
    });
    expect(runCliText).not.toHaveBeenCalled();
  });
  it('rejects older CLI builds before starting a provider run', async () => {
    vi.mocked(detectCli).mockResolvedValueOnce({
      id: 'cursor-agent',
      available: true,
      version: '2026.07.17-fixture',
      detail: '',
    });
    await expect(adapters['cursor-agent'].run(await contextFor('cursor-agent'))).rejects.toThrow(
      '2026.09.26 or newer',
    );
    expect(runCliText).not.toHaveBeenCalled();
  });
  it('rejects a failed terminal event even after a valid assistant response', async () => {
    await expect(
      adapters['cursor-agent'].run(await contextFor('cursor-agent', 'terminal-error')),
    ).rejects.toThrow('valid structured result');
  });
});

vi.mock('../src/process.ts', () =>
  import('./helpers/runtime-mocks.ts').then((m) => m.processMock()),
);
vi.mock('../src/acp.ts', () => import('./helpers/runtime-mocks.ts').then((m) => m.acpMock()));
