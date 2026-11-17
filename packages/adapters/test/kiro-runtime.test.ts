import type { RuntimeActivity } from '@pitchcrew/core';
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
  it('shows native tool calls and Pitchcrew calls that failed before reaching the daemon', async () => {
    const onActivity = vi.fn<(entry: RuntimeActivity) => void>();
    const context = await contextFor('kiro-cli', 'tool-calls');
    await adapters['kiro-cli'].chat({ ...context, card: null, messages: [], onActivity });
    const steps = onActivity.mock.calls.flatMap(([entry]) =>
      entry.kind === 'tool' ? [entry] : [],
    );
    // The v2 engine's successful call and the refusal the daemon recorded add no step.
    expect(steps).toEqual([
      {
        id: 'native-tool-2',
        kind: 'tool',
        tool: 'edit',
        label: "Couldn't save a memory",
        status: 'failed',
        error:
          'MCP error -32602: Input validation error: Invalid arguments for tool pitchcrew_save_memory: text is required',
        failure: { reason: 'invalid_input', tool: 'pitchcrew_save_memory' },
      },
      {
        id: 'native-tool-3',
        kind: 'tool',
        tool: 'command',
        label: 'Running command',
        detail: 'echo [redacted]',
        status: 'running',
      },
      {
        id: 'native-tool-3',
        kind: 'tool',
        tool: 'command',
        label: 'Command failed',
        detail: 'echo [redacted]',
        status: 'failed',
        error: 'Command failed: [redacted] was rejected',
        failure: { reason: 'tool_error' },
      },
      {
        id: 'native-tool-6',
        kind: 'tool',
        tool: 'search',
        label: "Couldn't recall saved context",
        status: 'failed',
        error:
          'MCP error -32602: Input validation error: Invalid arguments for tool pitchcrew_recall_memory: query is required',
        failure: { reason: 'invalid_input', tool: 'pitchcrew_recall_memory' },
      },
    ]);
    expect(JSON.stringify(onActivity.mock.calls)).not.toMatch(/PRIVATE_ARG|fictional-token/);
  });
});

vi.mock('../src/process.ts', () =>
  import('./helpers/runtime-mocks.ts').then((m) => m.processMock()),
);
vi.mock('../src/acp.ts', () => import('./helpers/runtime-mocks.ts').then((m) => m.acpMock()));
