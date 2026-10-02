import { afterEach, describe, expect, it, vi } from 'vitest';
import { adapters } from '../src/index.ts';
import { cleanup, contextFor, requestFor } from './helpers/runtime.ts';

afterEach(cleanup);
describe('Kiro ACP boundary', () => {
  it.each(['terminal-error', 'missing-terminal', 'rpc-error', 'wrong-protocol'])(
    'rejects %s without accepting an incomplete turn',
    async (mode) => {
      await expect(adapters['kiro-cli'].run(await contextFor('kiro-cli', mode))).rejects.toThrow();
    },
  );
  it('starts exactly one fresh session, disables client capabilities and cancels permission requests', async () => {
    const context = await contextFor('kiro-cli', 'client-request');
    expect((await adapters['kiro-cli'].run(context)).role).toBe('scout');
    const request = (await requestFor(context)) as Awaited<ReturnType<typeof requestFor>> & {
      requests: { method: string; params: Record<string, unknown> }[];
      responses: { id: string; result?: unknown; error?: unknown }[];
    };
    expect(request.requests.map((r) => r.method)).toEqual([
      'initialize',
      'session/new',
      'session/prompt',
    ]);
    expect(request.requests[0].params.clientCapabilities).toEqual({
      fs: { readTextFile: false, writeTextFile: false },
      terminal: false,
    });
    expect(request.requests[1].params).toEqual({ cwd: context.directory, mcpServers: [] });
    expect(request.responses).toContainEqual({
      jsonrpc: '2.0',
      id: 'permission',
      result: { outcome: { outcome: 'cancelled' } },
    });
    expect(request.responses).toContainEqual({
      jsonrpc: '2.0',
      id: 'file',
      error: { code: -32601, message: 'Pitchcrew does not provide this client capability.' },
    });
  });
});

vi.mock('../src/process.ts', () =>
  import('./helpers/runtime-mocks.ts').then((m) => m.processMock()),
);
vi.mock('../src/acp.ts', () => import('./helpers/runtime-mocks.ts').then((m) => m.acpMock()));
