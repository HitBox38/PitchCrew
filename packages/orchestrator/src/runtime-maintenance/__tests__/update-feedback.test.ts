import { afterEach, expect, it, vi } from 'vitest';
import { adapters } from '@pitchcrew/adapters';
import type { RuntimeUpdateInfo } from '@pitchcrew/core';
import type { RuntimeMaintenance } from '../index.ts';
import { executeRuntimeUpdate } from '../update.ts';

afterEach(() => vi.restoreAllMocks());

it.each(['', 'Fixture installer requires interactive input.'])(
  'reports failed installers truthfully for retained output %j',
  async (output) => {
    const operation: NonNullable<RuntimeUpdateInfo['operation']> = {
      id: 'fixture-operation',
      stage: 'preparing',
      startedAt: '2026-01-01T00:00:00Z',
      finishedAt: null,
      detail: '',
      output: '',
    };
    const update = {
      id: 'codex',
      latestVersion: '1.1.0',
      installedVersion: '1.0.0',
      operation,
    } as RuntimeUpdateInfo;
    const installation = {
      identity: 'fixture',
      executable: '/fixture/codex',
      command: { file: '/fixture/npm', args: [] },
    };
    const health = {
      id: 'codex' as const,
      version: '1.0.0',
      available: true,
      detail: 'Usable old version',
    };
    vi.spyOn(adapters.codex, 'detect').mockResolvedValue(health);
    const context = { closing: true, runtimes: [health], modelCatalogs: new Map() };
    const manager = {
      store: { state: { updates: [update], running: {} }, save: vi.fn() },
      installations: new Map([['codex', installation]]),
      controller: new AbortController(),
      active: new Map(),
      context: () => context,
      clearAuthentication: vi.fn(),
      authenticate: vi.fn(),
      output: (_id: string, text: string) => {
        operation.output += text;
      },
      host: {
        resolve: async () => installation,
        latest: async () => '1.1.0',
        run: async (_command: unknown, options: { onOutput: (text: string) => void }) => {
          options.onOutput(output);
          return { code: 1, stdout: '', stderr: output };
        },
      },
    } as unknown as RuntimeMaintenance;
    await executeRuntimeUpdate(manager, 'codex');
    expect(operation.stage).toBe('failed');
    expect(operation.finishedAt).not.toBeNull();
    expect(context.runtimes[0]).toEqual(health);
    if (output) expect(operation.detail).toContain('Review Installer output below');
    else {
      expect(operation.detail).toContain('without diagnostic output');
      expect(operation.detail).not.toContain('See its output');
    }
  },
);
