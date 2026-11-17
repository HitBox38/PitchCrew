import { adapters } from '@pitchcrew/adapters';
import {
  defaultCapabilities,
  type BrowserMode,
  type ChatContext,
  type ChatRequest,
  type ChatResult,
  type ComputerApproval,
  type Conversation,
  type Role,
  type Run,
  type UserInputRequest,
} from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, setup } from './helpers/daemon.ts';

type Turn = { context: ChatContext; token: string; complete: () => void };

const fixtureRun = (id: string): Run => ({
  id,
  cardId: null,
  roleId: 'writer',
  runtime: 'demo',
  threadId: 'writer',
  mode: 'chat',
  status: 'running',
  message: '',
  startedAt: '',
  finishedAt: null,
});

/** Writer and Scout browse with `browserMode` as their default; chat turns wait for the test. */
const fixture = async (browserMode?: BrowserMode) => {
  const driver = {
    snapshot: vi.fn(async () => ({
      url: 'https://8.8.8.8/jobs',
      title: 'Fictional jobs',
      text: 'Fictional posting',
      screenshot: '',
      digest: 'fixture',
    })),
    perform: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  };
  const fixture = await setup(false, { browserLaunch: async () => driver });
  const service = fixture.daemon.service;
  for (const id of ['scout', 'writer']) {
    const role = service.board.get<Role>('role', id);
    service.board.record(
      'role',
      {
        ...role,
        ...(browserMode ? { browserMode } : {}),
        capabilities: { ...defaultCapabilities, ...role.capabilities, computerUse: true },
      },
      'user',
      'Browser mode fixture',
    );
  }
  const turns: Turn[] = [];
  vi.spyOn(adapters.demo, 'chat').mockImplementation(
    (context) =>
      new Promise<ChatResult>((resolve, reject) => {
        context.signal.addEventListener('abort', () => reject(new Error('Stopped')), {
          once: true,
        });
        turns.push({
          context,
          token: context.mcp.env.PITCHCREW_RUN_TOKEN,
          complete: () => resolve({ reply: 'Fictional reply.' }),
        });
      }),
  );
  const modeOf = (runId: string) =>
    service.computer.browsers.list().find((item) => item.runId === runId)?.mode;
  const runOf = (turn: Turn) =>
    service.board.get<Run>('run', service.capabilities.get(turn.token)!.runId);
  /** The mode a turn's browser binds with at its first browser call. */
  const bound = async (turn: Turn) => {
    const { id } = runOf(turn);
    await service.agentCall(turn.token, 'computer_inspect', {});
    return modeOf(id);
  };
  /** Binds a saved fixture run's browser, then ends the run so the next one can bind. */
  const bindRun = async (changes: Partial<Run> & Pick<Run, 'id'>) => {
    const run = { ...fixtureRun(changes.id), ...changes };
    service.board.record('run', run, 'user', 'Browser mode fixture run');
    service.capabilities.set(run.id, { runId: run.id, roleId: run.roleId, cardId: run.cardId });
    await service.agentCall(run.id, 'computer_inspect', {});
    const mode = modeOf(run.id);
    await service.computer.stop(run.id);
    return mode;
  };
  return { ...fixture, service, turns, runOf, bound, bindRun };
};

afterEach(cleanup);

const routine = {
  name: 'Fictional browser check',
  roleId: 'writer',
  content: 'Check the fictional posting.',
  startAt: '2030-01-01T09:00:00Z',
  timezone: 'UTC',
  cron: null,
  intervalMinutes: null,
  maxRuns: null,
  endsAt: null,
  enabled: true,
};

it.each([
  ['started directly', false],
  ['queued for a job', true],
] as const)(
  'keeps a routine %s, its answer continuations and crew follow-ups supervised in Full access',
  async (_, job) => {
    const { service, turns, runOf, bound } = await fixture('full');
    const card = job
      ? service.createCard({ company: 'Fictional Company', title: 'Engineer' })
      : undefined;
    // An ordinary conversation: only the routine itself can keep this chain supervised.
    const thread = service.createConversation({
      title: 'Fictional routine target',
      participants: ['writer'],
      ...(card ? { cardId: card.id } : {}),
    });
    service.saveRoutine({ ...routine, cardId: card?.id ?? null, conversationId: thread.id });
    await service.tickRoutines(new Date(routine.startAt));
    await expect.poll(() => turns.length).toBe(1);
    const scheduled = runOf(turns[0]);
    expect(scheduled.routineId).toBeDefined();
    // A routine queued for a job is rooted at its chat request rather than at its first run.
    const queued = service.board.list<ChatRequest>('chat_request').find((item) => item.routine);
    expect(!!queued).toBe(job);
    expect(scheduled.rootRunId).toBe(queued?.id);
    expect(await bound(turns[0])).toBe('supervised');
    await service.agentCall(turns[0].token, 'invoke', {
      roleId: 'scout',
      content: 'Check the fictional company.',
    });
    const { question } = (await service.agentCall(turns[0].token, 'ask_user', {
      question: 'Which posting should I check?',
    })) as { question: UserInputRequest };
    await expect.poll(() => service.board.get<Run>('run', scheduled.id).status).toBe('waiting');
    service.answerUserQuestion(question.id, { text: 'The fictional one.' });
    await expect.poll(() => turns.length).toBe(2);
    const continuation = runOf(turns[1]);
    expect(continuation).toMatchObject({ roleId: 'writer', threadId: thread.id });
    expect(continuation.routineId).toBeUndefined();
    expect(continuation.rootRunId).toBe(scheduled.rootRunId ?? scheduled.id);
    expect(await bound(turns[1])).toBe('supervised');
    turns[1].complete();
    await expect.poll(() => turns.length).toBe(3);
    const followUp = runOf(turns[2]);
    expect(followUp).toMatchObject({ roleId: 'scout', rootRunId: continuation.rootRunId });
    expect(followUp.configuration?.role.browserMode).toBe('full');
    expect(await bound(turns[2])).toBe('supervised');
    turns[2].complete();
  },
);

it('keeps messages from external MCP apps and their follow-ups supervised, unlike user messages', async () => {
  const { service, turns, bound, request } = await fixture('full');
  const { request: sent } = (await service.externalCall('send_message', {
    conversationId: 'writer',
    content: 'Check the fictional posting.',
    clientRequestId: randomUUID(),
  })) as { request: ChatRequest };
  expect(sent.external).toBe(true);
  await expect.poll(() => turns.length).toBe(1);
  expect(await bound(turns[0])).toBe('supervised');
  await service.agentCall(turns[0].token, 'invoke', {
    roleId: 'scout',
    content: 'Check the fictional company.',
  });
  turns[0].complete();
  await expect.poll(() => turns.length).toBe(2);
  expect(turns[1].context.role.id).toBe('scout');
  expect(await bound(turns[1])).toBe('supervised');
  turns[1].complete();
  // The user's own messages keep the agent's Full access and cannot claim to be external.
  const own = await request<ChatRequest>('/conversations/writer/messages', 'POST', {
    content: 'Check it again.',
    external: true,
  });
  expect(own.response.status).toBe(202);
  expect(service.board.get<ChatRequest>('chat_request', own.result.id)).not.toHaveProperty(
    'external',
  );
  await expect.poll(() => turns.length).toBe(3);
  expect(await bound(turns[2])).toBe('full');
  turns[2].complete();
  // A deep review command from an external app stays an ordinary, marked message.
  const { request: command } = (await service.externalCall('send_message', {
    conversationId: 'writer',
    content: '/hiring-panel',
  })) as { request: ChatRequest };
  expect(command).toMatchObject({ external: true, deliveries: [{ roleId: 'writer' }] });
  expect(command).not.toHaveProperty('deepReviewPreferences');
  await expect.poll(() => turns.length).toBe(4);
  expect(await bound(turns[3])).toBe('supervised');
  turns[3].complete();
});

it.each(['edits', 'auto', 'full'] as const)(
  'captures a %s conversation override for later turns, never for a turn already running',
  async (mode) => {
    const { service, turns, bound } = await fixture();
    await service.sendConversation('writer', { content: 'Check the fictional posting.' });
    await expect.poll(() => turns.length).toBe(1);
    const changed = await service.updateConversation('writer', {
      configurations: { writer: { browserMode: mode } },
    });
    expect(changed.configurations.writer).toEqual({ browserMode: mode });
    expect(await bound(turns[0])).toBe('supervised');
    turns[0].complete();
    await service.sendConversation('writer', { content: 'Check it again.' });
    await expect.poll(() => turns.length).toBe(2);
    expect(turns[1].context.role.browserMode).toBe(mode);
    expect(await bound(turns[1])).toBe(mode);
    turns[1].complete();
  },
);

it('fails closed on unknown modes and recognizes routine and external chains in every shape', async () => {
  const { service, bindRun } = await fixture('full');
  const role = service.board.get<Role>('role', 'writer');
  const snapshot = (browserMode: string) => ({
    role: { ...role, browserMode: browserMode as BrowserMode },
    revision: '',
    skills: [],
    skillsRevision: '',
  });
  const saveRequest = (changes: Partial<ChatRequest>) => {
    const saved: ChatRequest = {
      id: randomUUID(),
      threadId: 'writer',
      messageId: randomUUID(),
      content: 'Fictional request',
      attachments: [],
      createdAt: new Date().toISOString(),
      order: 1,
      deliveries: [],
      ...changes,
    };
    service.board.record('chat_request', saved, 'user', 'Browser mode fixture request');
    return saved;
  };
  expect(await bindRun({ id: 'unknown-snapshot', configuration: snapshot('reckless') })).toBe(
    'supervised',
  );
  // Runs saved before configuration snapshots use the override, then the agent default.
  expect(await bindRun({ id: 'legacy-default' })).toBe('full');
  const conversation = service.board.get<Conversation>('conversation', 'writer');
  service.board.record(
    'conversation',
    { ...conversation, configurations: { writer: { browserMode: 'reckless' as BrowserMode } } },
    'user',
    'Unknown override fixture',
  );
  expect(await bindRun({ id: 'legacy-unknown-override' })).toBe('supervised');
  await service.updateConversation('writer', {
    configurations: { writer: { browserMode: 'auto' } },
  });
  expect(await bindRun({ id: 'legacy-override' })).toBe('auto');
  // A follow-up of an ordinary message keeps its own captured mode.
  const ordinary = saveRequest({});
  expect(
    await bindRun({
      id: 'ordinary-follow-up',
      rootRunId: ordinary.id,
      configuration: snapshot('full'),
    }),
  ).toBe('full');
  // A follow-up whose originating request was deleted with its conversation fails closed.
  expect(
    await bindRun({
      id: 'orphaned-follow-up',
      rootRunId: randomUUID(),
      configuration: snapshot('full'),
    }),
  ).toBe('supervised');
  // A deep review whose job was chosen from a question is rooted at the run that asked.
  const external = saveRequest({ external: true });
  service.board.record(
    'run',
    {
      ...fixtureRun('review-chooser'),
      requestId: external.id,
      deepReviewSelection: true,
      status: 'waiting',
    },
    'user',
    'Deep review chooser fixture',
  );
  expect(
    await bindRun({
      id: 'chosen-review',
      rootRunId: 'review-chooser',
      configuration: snapshot('full'),
    }),
  ).toBe('supervised');
  // Anything run in a routine's own conversation stays supervised.
  const now = new Date().toISOString();
  const routineThread: Conversation = {
    id: randomUUID(),
    title: 'Fictional routine',
    kind: 'routine',
    participants: ['writer'],
    leadId: 'writer',
    cardId: null,
    createdBy: 'system',
    createdAt: now,
    updatedAt: now,
    archived: false,
    pinned: false,
    configurations: {},
  };
  service.board.record('conversation', routineThread, 'system', 'Routine conversation fixture');
  expect(
    await bindRun({
      id: 'routine-thread',
      threadId: routineThread.id,
      configuration: snapshot('full'),
    }),
  ).toBe('supervised');
});

it('labels a step the browser mode or a site grant allowed, and a request that waits as asked', async () => {
  const { service } = await fixture('edits');
  const labels = (runId: string) =>
    service
      .chatState()
      .activityRuns?.find((item) => item.id === runId)
      ?.activity?.map((entry) => entry.label) ?? [];
  const start = (id: string) => {
    service.board.record('run', fixtureRun(id), 'user', 'Fixture browser run');
    service.capabilities.set(id, { runId: id, roleId: 'writer', cardId: null });
  };
  const ask = async (id: string, input: unknown) =>
    (
      (await service.agentCall(id, 'computer_request', { input, reason: 'Read the posting' })) as {
        approval: ComputerApproval;
      }
    ).approval;
  start('edits-run');
  const allowed = await ask('edits-run', { kind: 'scroll', selector: 'body', deltaY: 400 });
  expect(allowed).toMatchObject({ status: 'approved', automatic: true, mode: 'edits' });
  expect(labels('edits-run')).toEqual(['Allowed by Accept edits to scroll the page']);
  // The row that was allowed is the row that carries the step out.
  await service.agentCall('edits-run', 'computer_execute', { approvalId: allowed.id });
  const asked = await ask('edits-run', { kind: 'click', selector: '#apply' });
  expect(asked.status).toBe('pending');
  expect(labels('edits-run')).toEqual([
    'Scrolled the page',
    'Asked to click an element on 8.8.8.8',
  ]);
  await service.computer.stop('edits-run');
  // Autonomous preparation records name no mode: the user's task site grant allowed them.
  const writer = service.board.get<Role>('role', 'writer');
  service.board.record('role', { ...writer, browserMode: 'autonomous' }, 'user', 'Autonomous');
  start('autonomous-run');
  await service.agentCall('autonomous-run', 'computer_inspect', {});
  service.computer.allowSite(
    'autonomous-run',
    'autonomous-run',
    'https://8.8.8.8',
    true,
    undefined,
    true,
  );
  const granted = await ask('autonomous-run', { kind: 'navigate', url: 'https://8.8.8.8/jobs' });
  expect(granted).toMatchObject({ status: 'approved', automatic: true });
  expect(granted).not.toHaveProperty('mode');
  expect(labels('autonomous-run')).toEqual([
    'Read the page',
    'Allowed for a site you granted to open 8.8.8.8',
  ]);
});
