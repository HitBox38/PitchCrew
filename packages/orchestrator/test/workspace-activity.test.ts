import type { Run } from '@pitchcrew/core';
import { createWorkspaceActivity } from '../src/http/workspace-activity.ts';
import { cleanup, setup } from './helpers/daemon.ts';
import { afterEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';

afterEach(cleanup);
it('sends a terminal run once after its live activity is removed, and skips old saved runs', async () => {
  const { daemon } = await setup(15093);
  const run: Run = {
    id: randomUUID(),
    roleId: 'scout',
    runtime: 'demo',
    threadId: 'scout',
    mode: 'chat',
    cardId: null,
    status: 'running',
    startedAt: '',
    finishedAt: null,
    message: '',
  };
  const old = { ...run, id: randomUUID(), status: 'completed' as const };
  daemon.service.board.record('run', old, 'scout', 'Old run');
  daemon.service.board.record('run', run, 'scout', 'Started run');
  const read = createWorkspaceActivity(daemon.service);
  expect(read([])).toEqual([run]);
  const completed = { ...run, status: 'completed' as const };
  daemon.service.board.record('run', completed, 'scout', 'Finished run');
  expect(read([])).toEqual([completed]);
  expect(read([])).toEqual([]);
  expect(createWorkspaceActivity(daemon.service)([])).toEqual([]);
});
