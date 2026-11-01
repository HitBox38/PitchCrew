import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Run } from '@pitchcrew/core';
import { createCrewContext } from '../../crew/context.ts';
import type { CrewContext } from '../../crew/types.ts';
import { createTelemetryBuffer } from '../buffer.ts';
import { sanitizeBackendObservation } from '../sanitize.ts';

const resources: { context: CrewContext; directory: string }[] = [];
const fixture = async (purpose?: Run['purpose']) => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-agent-problems-'));
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
  context.board.seedRoles('demo', true);
  const run: Run = {
    id: 'private-run',
    roleId: 'scout',
    cardId: null,
    mode: 'workflow',
    runtime: 'demo',
    status: 'running',
    message: 'Private task',
    startedAt: '',
    finishedAt: null,
    purpose,
  };
  context.board.record('run', run, 'user', 'Fixture run');
  context.capabilities.set('private-token', { runId: run.id, roleId: run.roleId, cardId: null });
  context.controllers.set(run.id, new AbortController());
  return { context, buffer, run };
};

afterEach(async () => {
  vi.restoreAllMocks();
  for (const { context, directory } of resources.splice(0)) {
    context.controllers.clear();
    await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});

describe('agent-reported technical blockers', () => {
  it('buffers a fixed exception once per area per run without task or role data', async () => {
    const { context, buffer } = await fixture();
    expect(
      await context.agentCall('private-token', 'report_technical_problem', { area: 'browser' }),
    ).toEqual({ ok: true, duplicate: false });
    expect(
      await context.agentCall('private-token', 'report_technical_problem', { area: 'browser' }),
    ).toEqual({ ok: true, duplicate: true });
    await context.agentCall('private-token', 'report_technical_problem', { area: 'mcp' });
    const exceptions = buffer.read(0).observations.filter((entry) => entry.event === '$exception');
    expect(exceptions.map((entry) => entry.properties)).toEqual([
      { error_source: 'agent_report', error_category: 'technical_problem', error_area: 'browser' },
      { error_source: 'agent_report', error_category: 'technical_problem', error_area: 'mcp' },
    ]);
    expect(JSON.stringify(buffer.read(0))).not.toMatch(/private|scout|Private/);
  });

  it.each(['fit', 'application-draft', 'application-review', 'packet-evaluation'] as const)(
    'allows %s runs to report even when their application context is broken',
    async (purpose) => {
      const { context, buffer, run } = await fixture(purpose);
      // Even targeted subagents and deadline-only turns can report a technical blocker.
      context.board.record(
        'run',
        { ...run, deepReviewId: 'private-review', reviewSubagentId: 'private-child' },
        'user',
        'Fixture restricted review',
      );
      await context.agentCall('private-token', 'report_technical_problem', { area: 'documents' });
      expect(buffer.read(0).observations.some((entry) => entry.event === '$exception')).toBe(true);
    },
  );

  it('rejects invalid, stopped, completed and tools-free capabilities', async () => {
    const { context, buffer, run } = await fixture('source-extraction');
    const report = (token = 'private-token') =>
      context.agentCall(token, 'report_technical_problem', { area: 'runtime' });
    await expect(report('unknown')).rejects.toThrow('invalid or expired');
    await expect(report()).rejects.toThrow('Source extraction cannot call agent tools');
    context.board.record(
      'run',
      { ...run, purpose: undefined, status: 'completed' },
      'user',
      'Done',
    );
    await expect(report()).rejects.toThrow('active run');
    context.controllers.get(run.id)!.abort();
    await expect(report()).rejects.toThrow('invalid or expired');
    expect(buffer.read(0).observations.filter((entry) => entry.event === '$exception')).toEqual([]);
  });

  it('rejects free-form input and contains missing, disabled and broken diagnostic sinks', async () => {
    const { context, buffer } = await fixture();
    for (const data of [{ area: 'private-error' }, { area: 'mcp', message: 'private error' }])
      await expect(
        context.agentCall('private-token', 'report_technical_problem', data),
      ).rejects.toThrow();
    expect(buffer.read(0).observations.filter((entry) => entry.event === '$exception')).toEqual([]);
    context.diagnostics = undefined;
    await expect(
      context.agentCall('private-token', 'report_technical_problem', { area: 'mcp' }),
    ).resolves.toMatchObject({ ok: true });
    const offline = createTelemetryBuffer(sanitizeBackendObservation);
    context.diagnostics = offline;
    await context.agentCall('private-token', 'report_technical_problem', { area: 'browser' });
    expect(offline.read(0).observations).toEqual([]);
    context.diagnostics = {
      record: () => {
        throw new Error('transport failure');
      },
    };
    await expect(
      context.agentCall('private-token', 'report_technical_problem', { area: 'runtime' }),
    ).resolves.toMatchObject({ ok: true });
  });

  it('rebuilds the buffer payload and rejects invalid error vocabularies', () => {
    const buffer = createTelemetryBuffer(sanitizeBackendObservation, true);
    buffer.record('$exception', {
      error_source: 'agent_report',
      error_category: 'technical_problem',
      error_area: 'sources',
      message: 'private',
      roleId: 'private',
      $exception_list: [{ value: 'private' }],
    });
    for (const change of [
      { error_source: 'private' },
      { error_category: 'private' },
      { error_area: 'private' },
    ])
      buffer.record('$exception', {
        error_source: 'agent_report',
        error_category: 'technical_problem',
        error_area: 'sources',
        ...change,
      });
    expect(buffer.read(0).observations).toHaveLength(1);
    expect(buffer.read(0).observations[0].properties).toEqual({
      error_source: 'agent_report',
      error_category: 'technical_problem',
      error_area: 'sources',
    });
  });
});
