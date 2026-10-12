import { adapters } from '@pitchcrew/adapters';
import type { Run } from '@pitchcrew/core';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createCrewContext } from '../../crew/context.ts';

it.each(['chat', 'workflow'] as const)(
  'records fixed %s failure while preserving local error history',
  async (mode) => {
    const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-log-hook-'));
    const record = vi.fn();
    const context = createCrewContext(
      directory,
      'http://127.0.0.1:4417',
      '/unused/mcp.ts',
      true,
      undefined,
      { record },
    );
    context.runtimes = [
      {
        id: 'demo',
        available: true,
        version: 'fixture',
        detail: 'fixture',
        models: [],
        modelSource: 'none',
        modelDetail: 'Fixture',
      },
    ];
    await mkdir(join(directory, 'profile'));
    await writeFile(
      join(directory, 'profile/profile.md'),
      '# Fictional Candidate\nBuilt interfaces.',
    );
    const secret = 'private provider text /Users/fixture/profile.md';
    const adapter = vi
      .spyOn(adapters.demo, mode === 'chat' ? 'chat' : 'run')
      .mockRejectedValue(new Error(secret));
    try {
      const card = context.board.createCard({
        company: 'Fictional',
        title: 'Engineer',
        description: '',
        url: '',
        location: '',
        salary: '',
        tags: [],
      });
      const run =
        mode === 'chat'
          ? await context.startChatRun('scout', 'private prompt', null, 'scout')
          : await context.startRun(card.id, 'scout');
      await vi.waitFor(() => expect(context.board.get<Run>('run', run.id).status).toBe('failed'));
      await vi.waitFor(() => expect(context.controllers.size).toBe(0));
      expect(context.board.get<Run>('run', run.id).message).toBe(secret);
      expect(record.mock.calls.filter(([event]) => event === 'operational_log')).toEqual([
        ['operational_log', { code: 'runtime_run_failed', area: mode }],
      ]);
      expect(JSON.stringify(record.mock.calls)).not.toContain('private');
    } finally {
      adapter.mockRestore();
      await context.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);

describe('operational HTTP hook', () => {
  it('keeps the existing 400 response and records only a fixed HTTP code', async () => {
    const { setup, cleanup } = await import('../../../test/helpers/daemon.ts');
    const { daemon, request } = await setup(14588);
    const record = vi.spyOn(daemon.service.diagnostics!, 'record');
    try {
      const { response, result } = await request<{ error: string }>('/cards', 'POST', {
        company: 'Fictional',
      });
      expect(response.status).toBe(400);
      expect(result.error).toBeTruthy();
      expect(record).toHaveBeenCalledWith('operational_log', {
        code: 'http_request_failed',
        area: 'http',
      });
      expect(JSON.stringify(record.mock.calls)).not.toContain('Fictional');
    } finally {
      await cleanup();
    }
  });
});
