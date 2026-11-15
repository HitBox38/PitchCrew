import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Run } from '@pitchcrew/core';
import { createCrewContext } from '../../crew/context.ts';
import type { CrewContext } from '../../crew/types.ts';
import { createTelemetryBuffer } from '../buffer.ts';
import { sanitizeBackendObservation } from '../sanitize.ts';

const resources: { context: CrewContext; directory: string }[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const { context, directory } of resources.splice(0)) {
    await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});

it('records an undeclared move saved by an installed daemon as a content-free diagnostic', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-lifecycle-reports-'));
  const buffer = createTelemetryBuffer(sanitizeBackendObservation, true);
  const context = createCrewContext(
    directory,
    'http://127.0.0.1:4417',
    '',
    true,
    undefined,
    buffer,
  );
  resources.push({ context, directory });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  context.board.lifecycleMode = 'report';
  const run = {
    id: 'private-run',
    roleId: 'scout',
    cardId: null,
    mode: 'chat',
    runtime: 'demo',
    status: 'completed',
    message: 'Private reply',
    startedAt: '',
    finishedAt: null,
  } satisfies Run;
  context.board.record('run', run, 'system', 'Fixture finished');
  context.board.record('run', { ...run, status: 'running' }, 'system', 'Fixture restarted');
  expect(context.board.get<Run>('run', run.id).status).toBe('running');
  const logs = buffer
    .read(0)
    .observations.filter((entry) => entry.properties.code === 'daemon_lifecycle_violation');
  expect(logs.map((entry) => entry.properties)).toEqual([
    {
      code: 'daemon_lifecycle_violation',
      area: 'daemon',
      lifecycle: 'Run',
      from_status: 'completed',
      to_status: 'running',
    },
  ]);
  expect(JSON.stringify(logs)).not.toContain('private');
});
