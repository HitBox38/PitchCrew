import { adapters } from '@pitchcrew/adapters';
import type { ChatContext, ChatMessage, Run, RunActivity } from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { externalCall } from '../src/external/gateway.ts';
import type { CrewContext } from '../src/crew/types.ts';
import { cleanup, finish, setup } from './helpers/daemon.ts';

afterEach(cleanup);

/** A chat turn held open until `complete`, so tests drive its tool calls and runtime steps. */
const chatTurn = async () => {
  let turn: ChatContext | undefined;
  let complete!: () => void;
  vi.spyOn(adapters.demo, 'chat').mockImplementation((context) => {
    turn = context;
    return new Promise((resolve) => {
      complete = () => resolve({ reply: 'Done.' });
      // Closing the daemon stops the turn.
      context.signal.addEventListener('abort', complete, { once: true });
    });
  });
  const fixture = await setup();
  const { result: run } = await fixture.request<Run>('/roles/scout/chat', 'POST', {
    content: 'Check what you can.',
  });
  await vi.waitFor(() => expect(turn).toBeDefined());
  const token = [...fixture.daemon.service.capabilities.keys()][0]!;
  const call = (action: string, data: Record<string, unknown>) =>
    fixture.daemon.service.agentCall(token, action, data).catch(() => undefined);
  const steps = () =>
    fixture.daemon.service
      .chatState()
      .activityRuns!.find((item) => item.id === run.id)!
      .activity!.filter((entry) => entry.kind === 'tool');
  return { ...fixture, run, turn: turn!, call, steps, complete };
};

const shown = ({ label, tool, detail, error, status }: RunActivity) => ({
  label,
  tool,
  status,
  ...(detail ? { detail } : {}),
  ...(error ? { error } : {}),
});

it('names crew tool steps with their kind, an allowlisted detail and the reason they failed', async () => {
  const { daemon, directory, request, run, call, steps, complete } = await chatTurn();
  const attachment = { id: randomUUID(), name: 'resume-2026.pdf', mimeType: 'application/pdf' };
  const message = {
    id: randomUUID(),
    threadId: 'scout',
    from: 'user',
    to: 'scout',
    content: 'See the attached file.',
    cardId: null,
    runId: null,
    createdAt: new Date().toISOString(),
    attachments: [{ ...attachment, size: 4, sha256: 'fixture' }],
  } satisfies ChatMessage;
  daemon.service.board.record('message', message, 'user', 'Fixture attachment');

  await call('recall_memory', { input: { query: 'salary expectations' } });
  await call('message', { roleId: 'writer', content: '' });
  await call('connector', {
    tool: 'gmail_search_messages',
    input: { query: 'from:private-person@example.test' },
  });
  await call('import_job_link', {
    input: { url: 'https://jobs.example.test/private/role?ref=private-secret' },
  });
  await call('delegate_round', {
    input: { delegates: [{ roleId: 'writer', content: 'Private subtask', note: 'private' }] },
  });
  await call('workflow', { state: 'in_review', reason: '' });
  // The file is gone from disk: the system error names a local path, which never shows.
  await call('chat_attachment', { messageId: message.id, attachmentId: attachment.id });

  expect(steps().map(shown)).toEqual([
    {
      label: 'Recalled saved context',
      tool: 'search',
      status: 'completed',
      detail: 'salary expectations',
    },
    {
      label: "Couldn't message a crew member",
      tool: 'agent',
      status: 'failed',
      detail: 'Writer',
      error: 'Too small: expected string to have >=1 characters at content',
    },
    {
      label: "Couldn't read connected sources",
      tool: 'mcp',
      status: 'failed',
      detail: 'Gmail · search messages',
      error: 'This connector capability is disabled for your role. Enable it in Crew.',
    },
    {
      label: "Couldn't read job link",
      tool: 'fetch',
      status: 'failed',
      detail: 'jobs.example.test',
      error: 'Job discovery is disabled for your role or this run has ended.',
    },
    {
      label: "Couldn't delegate subtasks to the crew",
      tool: 'agent',
      status: 'failed',
      detail: '1 subtask',
      error: 'Unexpected field at delegates.0',
    },
    {
      label: "Couldn't update application workflow",
      tool: 'edit',
      status: 'failed',
      detail: 'in review',
      error: 'Too small: expected string to have >=1 characters at reason',
    },
    {
      label: "Couldn't read attachment",
      tool: 'read',
      status: 'failed',
      detail: 'resume-2026.pdf',
      error: 'A local file could not be read or written.',
    },
  ]);
  const live = JSON.stringify(steps());
  expect(live).not.toMatch(/private|Private|secret/);
  expect(live).not.toContain(directory);

  // Saved, replayed and read by an external agent with the same public fields.
  const saved = steps();
  complete();
  await finish(request, run.id);
  await vi.waitFor(() =>
    expect(daemon.service.board.get<Run>('run', run.id).activity).toBeDefined(),
  );
  daemon.service.board.rebuild();
  const replayed = daemon.service.board.get<Run>('run', run.id).activity!;
  expect(replayed.filter((entry) => entry.kind === 'tool')).toEqual(saved);
  const external = (await externalCall(
    { board: daemon.service.board, runActivities: new Map() } as unknown as CrewContext,
    'read_run',
    { runId: run.id },
  )) as { run: { activity: RunActivity[] } };
  expect(JSON.parse(JSON.stringify(external.run.activity))).toEqual(
    JSON.parse(JSON.stringify(replayed)),
  );
});

it('records runtime steps without their transient failure and reports only its closed words', async () => {
  const { daemon, run, turn, steps } = await chatTurn();
  const record = vi.spyOn(daemon.service.diagnostics!, 'record');
  turn.onActivity!({
    id: 'native-call-1',
    kind: 'tool',
    tool: 'command',
    label: 'Running command',
    detail: 'npm test',
    status: 'running',
  });
  turn.onActivity!({
    id: 'native-call-1',
    kind: 'tool',
    label: 'Command failed',
    status: 'failed',
    error: 'Exit code 1: private assertion failed',
    failure: { reason: 'tool_error' },
  });
  turn.onActivity!({
    id: 'native-call-2',
    kind: 'tool',
    tool: 'read',
    label: "Couldn't read job details",
    status: 'failed',
    error: 'MCP error -32602: Input validation error: private',
    failure: { reason: 'invalid_input', tool: 'pitchcrew_get_card' },
  });
  expect(steps()).toEqual([
    expect.objectContaining({
      id: 'native-call-1',
      tool: 'command',
      detail: 'npm test',
      label: 'Command failed',
      error: 'Exit code 1: private assertion failed',
    }),
    expect.objectContaining({ id: 'native-call-2', tool: 'read', status: 'failed' }),
  ]);
  expect(JSON.stringify(steps())).not.toContain('failure');
  const exceptions = record.mock.calls.filter(([event]) => event === '$exception');
  expect(exceptions.map(([, properties]) => properties)).toEqual([
    {
      error_source: 'runtime_tool',
      error_category: 'tool_error',
      error_tool_kind: 'command',
      $mcp_session_id: expect.any(String),
      $session_id: expect.any(String),
    },
    {
      error_source: 'tool_call',
      error_category: 'invalid_input',
      error_tool: 'pitchcrew_get_card',
      error_boundary: 'runtime',
      $mcp_session_id: expect.any(String),
      $session_id: expect.any(String),
    },
  ]);
  expect(JSON.stringify(exceptions)).not.toMatch(/private|npm|Exit code/);
  expect(daemon.service.board.get<Run>('run', run.id).status).toBe('running');
});

it('keeps a failed external activity entry to its public fields', async () => {
  const { daemon, run } = await chatTurn();
  const step = {
    id: 'native-call-3',
    kind: 'tool' as const,
    tool: 'fetch' as const,
    label: "Couldn't fetch page",
    detail: 'https://example.test/jobs',
    error: 'Request failed',
    status: 'failed' as const,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
  };
  const context = {
    board: daemon.service.board,
    runActivities: new Map([
      [
        run.id,
        {
          entries: [{ ...step, failure: { reason: 'tool_error' }, raw: 'private payload' }],
          truncated: false,
        },
      ],
    ]),
  } as unknown as CrewContext;
  const result = (await externalCall(context, 'read_run', { runId: run.id })) as {
    run: { activity: Record<string, unknown>[] };
  };
  expect(JSON.parse(JSON.stringify(result.run.activity))).toEqual([step]);
});
