import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  mcpGatewayTools,
  userDeclinedError,
  type ActivityToolKind,
  type Run,
  type ToolFailureReason,
} from '@pitchcrew/core';
import { recordRuntimeActivity, reportRuntimeFailure } from '../../crew/chat-activity.ts';
import { createCrewContext } from '../../crew/context.ts';
import type { CrewContext, RunCapability } from '../../crew/types.ts';
import { createTelemetryBuffer } from '../buffer.ts';
import { sanitizeBackendObservation } from '../sanitize.ts';
import { recordToolFailure } from '../tool-failures.ts';

const resources: { context: CrewContext; directory: string }[] = [];
const fixture = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-tool-failures-'));
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
    mode: 'chat',
    threadId: 'scout',
    runtime: 'demo',
    status: 'running',
    message: 'Private task',
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  context.board.record('run', run, 'user', 'Fixture run');
  const capability: RunCapability = { runId: run.id, roleId: 'scout', cardId: null };
  context.capabilities.set('private-token', capability);
  context.controllers.set(run.id, new AbortController());
  const observations = (event: string) =>
    buffer
      .read(0)
      .observations.filter((entry) => entry.event === event)
      .map((entry) => entry.properties);
  return { context, buffer, run, capability, observations };
};

afterEach(async () => {
  vi.restoreAllMocks();
  for (const { context, directory } of resources.splice(0)) {
    context.controllers.clear();
    await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});

const failing = (context: CrewContext, error: unknown) =>
  vi.spyOn(context.board, 'list').mockImplementation(() => {
    throw error;
  });
const tool = (name: string, reason: ToolFailureReason = 'internal') =>
  ({
    error_source: 'tool_call',
    error_category: reason,
    error_tool: name,
    error_boundary: 'gateway',
  }) as const;

describe('failed tool call reports', () => {
  it('reports a gateway failure once per tool and reason, in closed words beside its call', async () => {
    const { context, buffer, observations } = await fixture();
    const error = new TypeError('private detail at /Users/private/notes.md');
    failing(context, error);
    for (let i = 0; i < 2; i++)
      await expect(context.agentCall('private-token', 'roles', {})).rejects.toBe(error);
    const [call] = observations('$mcp_tool_call');
    expect(call).toMatchObject({ $mcp_is_error: true, $mcp_error_type: 'internal' });
    expect(observations('$mcp_tool_call')).toHaveLength(2);
    expect(observations('$exception')).toEqual([
      {
        ...tool('pitchcrew_list_roles'),
        $mcp_session_id: call!.$mcp_session_id,
        $session_id: call!.$mcp_session_id,
      },
    ]);
    // Another reason for the same tool is another issue.
    failing(context, new Error('Workflow capability is disabled for your role.'));
    await expect(context.agentCall('private-token', 'roles', {})).rejects.toThrow('disabled');
    expect(observations('$exception').map((entry) => entry.error_category)).toEqual([
      'internal',
      'not_allowed',
    ]);
    expect(JSON.stringify(buffer.read(0))).not.toMatch(/private|Private|disabled|notes/);
  });

  it('never reports the user’s own outcomes, though the call still names them', async () => {
    const { context, run, observations } = await fixture();
    failing(context, new Error(userDeclinedError));
    await expect(context.agentCall('private-token', 'roles', {})).rejects.toThrow('declined');
    failing(context, new Error('Manual control is active. Wait for the user to return control.'));
    await expect(context.agentCall('private-token', 'roles', {})).rejects.toThrow('Manual');
    context.controllers.get(run.id)!.abort();
    await expect(context.agentCall('private-token', 'roles', {})).rejects.toThrow('expired');
    expect(observations('$mcp_tool_call').map((entry) => entry.$mcp_error_type)).toEqual([
      'declined',
      'user_control',
      'cancelled',
    ]);
    expect(observations('$exception')).toEqual([]);
  });

  it('reports a failure without a transcript and ignores unreviewed or unauthenticated calls', async () => {
    const { context, run, observations } = await fixture();
    context.board.record(
      'run',
      { ...run, mode: 'workflow', threadId: undefined },
      'user',
      'Fixture',
    );
    failing(context, new TypeError('private'));
    await expect(context.agentCall('private-token', 'roles', {})).rejects.toThrow('private');
    await expect(context.agentCall('private-token', 'private_unknown', {})).rejects.toThrow();
    await expect(
      context.agentCall('private-token', 'connector', { tool: 'private_tool' }),
    ).rejects.toThrow();
    await expect(context.agentCall('unknown-token', 'roles', {})).rejects.toThrow();
    expect(observations('$exception')).toEqual([
      expect.objectContaining(tool('pitchcrew_list_roles')),
    ]);
  });

  it('allows eight fault reports a run and twenty a minute', async () => {
    const { context, capability } = await fixture();
    const record = vi.spyOn(context.diagnostics!, 'record');
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const names = Object.values(mcpGatewayTools);
    for (const name of names.slice(0, 9)) recordToolFailure(context, capability, tool(name));
    expect(record).toHaveBeenCalledTimes(8);
    const others = [1, 2].map((index) => ({ ...capability, runId: `other-run-${index}` }));
    for (const other of others)
      for (const name of names.slice(0, 8)) recordToolFailure(context, other, tool(name));
    expect(record).toHaveBeenCalledTimes(20);
    // A report held back by the minute's limit is not counted as seen.
    now.mockReturnValue(1_060_000);
    recordToolFailure(context, others[1]!, tool(names[7]!));
    expect(record).toHaveBeenCalledTimes(21);
  });

  it('still reports a fault after eight refusals in its run', async () => {
    const { context, capability, observations } = await fixture();
    const names = Object.values(mcpGatewayTools);
    const refusals: ToolFailureReason[] = [
      'rejected',
      'conflict',
      'not_allowed',
      'approval_required',
      'invalid_input',
      'not_found',
      'limit_reached',
      'setup_required',
    ];
    refusals.forEach((reason, index) =>
      recordToolFailure(context, capability, tool(names[index]!, reason)),
    );
    recordToolFailure(context, capability, tool(names[8]!, 'tool_error'));
    recordToolFailure(context, capability, tool(names[9]!, 'internal'));
    expect(observations('$exception').map((entry) => entry.error_category)).toEqual([
      ...refusals,
      'internal',
    ]);
  });

  it('still reports a fault after twenty refusals in a minute', async () => {
    const { context, capability, observations } = await fixture();
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const names = Object.values(mcpGatewayTools);
    const runs = [1, 2, 3, 4].map((index) => ({ ...capability, runId: `delegate-run-${index}` }));
    for (const run of runs.slice(0, 3))
      for (const name of names.slice(0, 7))
        recordToolFailure(context, run, tool(name, 'not_allowed'));
    expect(observations('$exception')).toHaveLength(20);
    recordToolFailure(context, runs[3]!, tool(names[0]!, 'rejected'));
    recordToolFailure(context, runs[3]!, tool(names[0]!, 'timeout'));
    expect(observations('$exception')).toHaveLength(21);
    expect(observations('$exception').at(-1)).toMatchObject({
      error_category: 'timeout',
      $mcp_session_id: expect.any(String),
    });
  });

  it('keeps the original error when diagnostics are missing, disabled or broken', async () => {
    const { context } = await fixture();
    const error = new TypeError('private original error');
    failing(context, error);
    context.diagnostics = undefined;
    await expect(context.agentCall('private-token', 'roles', {})).rejects.toBe(error);
    const offline = createTelemetryBuffer(sanitizeBackendObservation);
    context.diagnostics = offline;
    await expect(context.agentCall('private-token', 'roles', {})).rejects.toBe(error);
    expect(offline.read(0).observations).toEqual([]);
    context.diagnostics = {
      record: () => {
        throw new Error('transport failure');
      },
    };
    await expect(context.agentCall('private-token', 'roles', {})).rejects.toBe(error);
  });

  it('reports a failed runtime step by kind or reviewed name, only while the turn shows it', async () => {
    const { context, run, observations } = await fixture();
    const step = { kind: 'tool', status: 'failed', error: 'Exit code 1: private output' } as const;
    recordRuntimeActivity(context, run.id, 'private-token', {
      ...step,
      id: 'native-1',
      tool: 'command',
      label: 'Command failed',
      failure: { reason: 'tool_error' },
    });
    recordRuntimeActivity(context, run.id, 'private-token', {
      ...step,
      id: 'native-2',
      tool: 'read',
      label: "Couldn't read job details",
      failure: { reason: 'invalid_input', tool: 'pitchcrew_get_card' },
    });
    // A stopped call is the user's outcome, and an unreviewed name falls back to the kind.
    recordRuntimeActivity(context, run.id, 'private-token', {
      ...step,
      id: 'native-3',
      label: 'Tool failed',
      failure: { reason: 'cancelled' },
    });
    recordRuntimeActivity(context, run.id, 'private-token', {
      ...step,
      id: 'native-4',
      tool: 'mcp',
      label: 'Tool call failed',
      failure: { reason: 'unavailable', tool: 'private_tool' },
    });
    expect(observations('$exception')).toEqual([
      expect.objectContaining({
        error_source: 'runtime_tool',
        error_category: 'tool_error',
        error_tool_kind: 'command',
      }),
      expect.objectContaining({
        error_source: 'tool_call',
        error_category: 'invalid_input',
        error_tool: 'pitchcrew_get_card',
        error_boundary: 'runtime',
      }),
      expect.objectContaining({
        error_source: 'runtime_tool',
        error_category: 'unavailable',
        error_tool_kind: 'mcp',
      }),
    ]);
    expect(
      context.runActivities.get(run.id)!.entries.map((entry) => Object.keys(entry)),
    ).not.toEqual(expect.arrayContaining([expect.arrayContaining(['failure'])]));
    context.board.record('run', { ...run, status: 'completed' }, 'user', 'Fixture finished');
    recordRuntimeActivity(context, run.id, 'private-token', {
      ...step,
      id: 'native-5',
      tool: 'edit',
      label: "Couldn't edit file",
      failure: { reason: 'internal' },
    });
    expect(observations('$exception')).toHaveLength(3);
    expect(JSON.stringify(observations('$exception'))).not.toMatch(/private|Exit code/);
  });

  it('reports a workflow run’s failed runtime call without recording a step', async () => {
    const { context, run, observations } = await fixture();
    // Workflow runs keep a thread, so a recorded step would show there.
    context.board.record('run', { ...run, mode: 'workflow' }, 'user', 'Fixture workflow');
    const pregateway = {
      reason: 'invalid_input',
      tool: 'pitchcrew_lint_packet',
      kind: 'check',
    } as const;
    reportRuntimeFailure(context, run.id, 'private-token', pregateway);
    reportRuntimeFailure(context, run.id, 'private-token', pregateway);
    reportRuntimeFailure(context, run.id, 'private-token', {
      reason: 'tool_error',
      kind: 'command',
    });
    // The user's own outcome and an unknown token report nothing; an unknown kind is "other".
    reportRuntimeFailure(context, run.id, 'private-token', { reason: 'cancelled', kind: 'edit' });
    reportRuntimeFailure(context, run.id, 'unknown-token', { reason: 'internal', kind: 'edit' });
    reportRuntimeFailure(context, run.id, 'private-token', {
      reason: 'timeout',
      kind: 'private' as ActivityToolKind,
    });
    expect(observations('$exception')).toEqual([
      expect.objectContaining({
        error_source: 'tool_call',
        error_category: 'invalid_input',
        error_tool: 'pitchcrew_lint_packet',
        error_boundary: 'runtime',
        $mcp_session_id: expect.any(String),
      }),
      expect.objectContaining({
        error_source: 'runtime_tool',
        error_category: 'tool_error',
        error_tool_kind: 'command',
      }),
      expect.objectContaining({
        error_source: 'runtime_tool',
        error_category: 'timeout',
        error_tool_kind: 'other',
      }),
    ]);
    expect(context.runActivities.has(run.id)).toBe(false);
    expect(context.board.get<Run>('run', run.id).activity).toBeUndefined();
  });

  it('reports nothing for a run that was aborted, is closing or stopped', async () => {
    const { context, run, observations } = await fixture();
    context.board.record('run', { ...run, mode: 'workflow' }, 'user', 'Fixture workflow');
    const report = (kind: ActivityToolKind, runId = run.id) =>
      reportRuntimeFailure(context, runId, 'private-token', { reason: 'internal', kind });
    context.controllers.get(run.id)!.abort();
    report('read');
    context.controllers.set(run.id, new AbortController());
    context.closing = true;
    report('edit');
    context.closing = false;
    context.board.record('run', { ...run, reviewSeatReservation: true }, 'user', 'Fixture seat');
    report('search');
    context.board.record('run', { ...run, mode: 'workflow' }, 'user', 'Fixture workflow');
    report('fetch', 'missing-run');
    expect(observations('$exception')).toEqual([]);
    report('fetch');
    context.board.record('run', { ...run, status: 'cancelled' }, 'user', 'Fixture stopped');
    report('command');
    expect(observations('$exception')).toEqual([
      expect.objectContaining({ error_category: 'internal', error_tool_kind: 'fetch' }),
    ]);
  });

  it('rebuilds buffered tool failures and drops unreviewed vocabularies', () => {
    const buffer = createTelemetryBuffer(sanitizeBackendObservation, true);
    buffer.record('$exception', {
      ...tool('pitchcrew_list_roles', 'timeout'),
      message: 'private',
      $exception_list: [{ value: 'private' }],
    });
    for (const change of [
      { error_category: 'private' },
      { error_category: 'declined' },
      { error_tool: 'private_tool' },
    ])
      buffer.record('$exception', { ...tool('pitchcrew_list_roles'), ...change });
    expect(buffer.read(0).observations.map((entry) => entry.properties)).toEqual([
      tool('pitchcrew_list_roles', 'timeout'),
    ]);
  });
});
