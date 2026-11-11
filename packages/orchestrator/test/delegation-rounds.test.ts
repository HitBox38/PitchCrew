import { afterEach, expect, it, vi } from 'vitest';
import { adapters } from '@pitchcrew/adapters';
import {
  type AgentTask,
  type ChatContext,
  type ChatRequest,
  type ChatResult,
  type Conversation,
  type DelegationRound,
  type Snapshot,
  type UserInputRequest,
  type WorkQueue,
} from '@pitchcrew/core';
import { setup, cleanup, waitForSnapshot } from './helpers/daemon.ts';

const held = () => {
  const turns: {
    context: ChatContext;
    complete: (reply?: string) => void;
    fail: (message: string) => void;
  }[] = [];
  vi.spyOn(adapters.demo, 'chat').mockImplementation(
    (context) =>
      new Promise<ChatResult>((resolve, reject) => {
        context.signal.addEventListener('abort', () => reject(new Error('Run cancelled.')), {
          once: true,
        });
        turns.push({
          context,
          complete: (reply = 'Done.') => resolve({ reply }),
          fail: (message) => reject(new Error(message)),
        });
      }),
  );
  return turns;
};
const roleTurn = (turns: ReturnType<typeof held>, roleId: string, after = 0) =>
  turns.slice(after).find((turn) => turn.context.role.id === roleId)!;
const makeCard = (daemon: Awaited<ReturnType<typeof setup>>['daemon']) =>
  daemon.service.board.createCard({
    company: 'Waypoint',
    title: 'Engineer',
    description: 'Fixture',
    url: '',
    location: '',
    salary: '',
    tags: [],
  });

afterEach(cleanup);

it('runs a lead-started round concurrently on one job and collects every result in one turn', async () => {
  const { daemon, request } = await setup();
  const turns = held();
  const card = makeCard(daemon);
  const group = (
    await request<Conversation>('/conversations', 'POST', {
      title: 'Application planning',
      participants: ['scout', 'writer', 'tracker'],
      leadId: 'scout',
      cardId: card.id,
    })
  ).result;
  await request(`/conversations/${group.id}/messages`, 'POST', { content: '@scout Plan this.' });
  await vi.waitFor(() => expect(turns).toHaveLength(1));
  const token = turns[0].context.mcp.env.PITCHCREW_RUN_TOKEN;
  const call = (action: string, data: Record<string, unknown>) =>
    daemon.service.agentCall(token, action, data);
  await expect(
    call('delegate_round', { input: { delegates: [{ roleId: 'scout', content: 'Self.' }] } }),
  ).rejects.toThrow('cannot be its own delegate');
  await expect(
    call('delegate_round', {
      input: {
        delegates: [
          { roleId: 'writer', content: 'One.' },
          { roleId: 'writer', content: 'Two.' },
        ],
      },
    }),
  ).rejects.toThrow('appears twice');
  await expect(
    call('delegate_round', {
      input: {
        delegates: ['writer', 'tracker', 'reviewer', 'submitter', 'documenter'].map((roleId) => ({
          roleId,
          content: 'Too many.',
        })),
      },
    }),
  ).rejects.toThrow();
  const started = (await call('delegate_round', {
    input: {
      delegates: [
        { roleId: 'writer', content: 'Draft three bullets.' },
        { roleId: 'tracker', content: 'Check the application status.' },
      ],
    },
  })) as { round: { id: string; delegates: DelegationRound['delegates'] } };
  expect(started.round.delegates.map((delegate) => delegate.roleId)).toEqual(['writer', 'tracker']);
  // Nothing starts while the lead's own turn is still running.
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(turns).toHaveLength(1);
  turns[0].complete('I asked Writer and Tracker.');
  await vi.waitFor(() => expect(turns).toHaveLength(3));
  const writer = roleTurn(turns, 'writer');
  const tracker = roleTurn(turns, 'tracker');
  expect(writer.context.request).toBe('Draft three bullets.');
  expect(writer.context.card?.id).toBe(card.id);
  expect(writer.context.delegation).toMatchObject({ part: 'delegate', leadId: 'scout' });
  expect(tracker.context.delegation).toMatchObject({ part: 'delegate', initiator: 'scout' });
  expect(writer.context.conversation?.id).not.toBe(group.id);
  await expect(
    daemon.service.agentCall(writer.context.mcp.env.PITCHCREW_RUN_TOKEN, 'message', {
      roleId: 'tracker',
      content: 'Nested.',
    }),
  ).rejects.toThrow('cannot message, invoke or delegate');
  expect(
    (
      await daemon.service.agentCall(
        writer.context.mcp.env.PITCHCREW_RUN_TOKEN,
        'execution_access',
        {},
      )
    ).delegate,
  ).toBe(true);
  writer.complete('Writer findings: three bullets drafted.');
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(turns).toHaveLength(3);
  tracker.complete('Tracker findings: no reply yet.');
  await vi.waitFor(() => expect(turns).toHaveLength(4));
  const collection = turns[3];
  expect(collection.context.role.id).toBe('scout');
  expect(collection.context.conversation?.id).toBe(group.id);
  expect(collection.context.delegation).toMatchObject({
    part: 'collection',
    delegates: ['writer', 'tracker'],
  });
  expect(collection.context.request).toContain('Writer findings: three bullets drafted.');
  expect(collection.context.request).toContain('Tracker findings: no reply yet.');
  expect(collection.context.request).toContain('Check the application status.');
  collection.complete('Both delegates reported back.');
  const snapshot = await waitForSnapshot(
    request,
    (snapshot) =>
      snapshot.delegationRounds?.find((round) => round.id === started.round.id)?.status ===
      'completed',
  );
  const round = snapshot.delegationRounds!.find((item) => item.id === started.round.id)!;
  expect(round).toMatchObject({ leadId: 'scout', initiator: 'scout', threadId: group.id });
  expect(snapshot.tasks.filter((task) => task.roundId === round.id)).toHaveLength(3);
  expect(
    snapshot.tasks.filter((task) => task.roundId === round.id).map((task) => task.status),
  ).toEqual(['completed', 'completed', 'completed']);
  const reply = snapshot.messages.find(
    (message) => message.content === 'Both delegates reported back.',
  );
  expect(reply).toMatchObject({ threadId: group.id, from: 'scout', to: 'user' });
  expect(
    snapshot.messages.some(
      (message) => message.content === 'Draft three bullets.' && message.from === 'scout',
    ),
  ).toBe(true);
});

it('queues delegation rounds after six follow-ups and cancels every branch with the conversation', async () => {
  const { daemon, request } = await setup();
  const turns = held();
  await request('/conversations/scout/messages', 'POST', { content: 'Coordinate this work.' });
  await vi.waitFor(() => expect(turns).toHaveLength(1));
  const token = turns[0].context.mcp.env.PITCHCREW_RUN_TOKEN;
  for (let i = 0; i < 6; i++)
    await daemon.service.agentCall(token, 'invoke', {
      roleId: 'scout',
      content: `Follow-up ${i}`,
    });
  const rounds: DelegationRound[] = [];
  for (let i = 0; i < 2; i++) {
    const result = (await daemon.service.agentCall(token, 'delegate_round', {
      input: { delegates: [{ roleId: 'writer', content: `Investigate question ${i}.` }] },
    })) as { round: { id: string } };
    rounds.push(daemon.service.board.get<DelegationRound>('delegation_round', result.round.id));
  }
  expect(rounds[1].rootRunId).toBe(rounds[0].rootRunId);
  expect(turns).toHaveLength(1);
  await request('/conversations/scout/stop', 'POST');
  const snapshot = await waitForSnapshot(request, (state) =>
    state.runs.every((run) => run.status === 'cancelled'),
  );
  expect(snapshot.tasks).toHaveLength(10);
  expect(snapshot.tasks.every((task) => task.status === 'cancelled')).toBe(true);
  expect(snapshot.tasks.every((task) => task.rootRunId === rounds[0].rootRunId)).toBe(true);
  expect(snapshot.delegationRounds).toHaveLength(2);
  expect(snapshot.delegationRounds!.every((round) => round.status === 'cancelled')).toBe(true);
  expect(turns).toHaveLength(1);
});

it('lets the user delegate from the composer, turns a stopped delegate into a cancelled result and still collects', async () => {
  const { daemon, request } = await setup();
  const turns = held();
  const group = (
    await request<Conversation>('/conversations', 'POST', {
      title: 'Research',
      participants: ['scout', 'writer'],
      leadId: 'scout',
    })
  ).result;
  const sent = await request<ChatRequest>(`/conversations/${group.id}/delegate`, 'POST', {
    content: 'Compare these two offers.',
    roleIds: ['writer', 'reviewer'],
  });
  expect(sent.response.status).toBe(202);
  expect(sent.result.deliveries).toEqual([]);
  expect(sent.result.roundId).toBeTruthy();
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  const writer = roleTurn(turns, 'writer');
  const reviewer = roleTurn(turns, 'reviewer');
  expect(writer.context.delegation).toMatchObject({ part: 'delegate', initiator: 'user' });
  expect(reviewer.context.request).toBe('Compare these two offers.');
  const round = daemon.service.board.get<DelegationRound>('delegation_round', sent.result.roundId!);
  expect(round.requestId).toBe(sent.result.id);
  const writerDm = round.delegates.find((delegate) => delegate.roleId === 'writer')!.threadId;
  expect(
    (await request(`/conversations/${writerDm}/stop`, 'POST', { roleId: 'writer' })).response
      .status,
  ).toBe(200);
  expect(writer.context.signal.aborted).toBe(true);
  expect(reviewer.context.signal.aborted).toBe(false);
  reviewer.complete('Reviewer notes: offer B pays more.');
  await vi.waitFor(() => expect(turns).toHaveLength(3));
  const collection = turns[2];
  expect(collection.context.role.id).toBe('scout');
  expect(collection.context.conversation?.id).toBe(group.id);
  expect(collection.context.request).toContain('Reviewer notes: offer B pays more.');
  expect(collection.context.request).toMatch(/writer.*cancelled/is);
  collection.complete('Reviewer answered; Writer was stopped.');
  const snapshot = await waitForSnapshot(
    request,
    (snapshot) =>
      snapshot.delegationRounds?.find((item) => item.id === round.id)?.status === 'completed',
  );
  const tasks = snapshot.tasks.filter((task) => task.roundId === round.id);
  expect(tasks.find((task) => task.roleId === 'writer')?.status).toBe('cancelled');
  expect(tasks.find((task) => task.roleId === 'reviewer')?.status).toBe('completed');
  expect(snapshot.messages.at(-1)).toMatchObject({ threadId: group.id, from: 'scout', to: 'user' });
  await expect(
    request(`/conversations/${group.id}/delegate`, 'POST', {
      content: 'Again',
      roleIds: ['scout'],
    }),
  ).resolves.toMatchObject({ response: expect.objectContaining({ status: 400 }) });
});

it('cancels the collection with the rest of the lane on Stop and replays rounds from events', async () => {
  const { daemon, request } = await setup();
  const turns = held();
  const group = (
    await request<Conversation>('/conversations', 'POST', {
      title: 'Stopped round',
      participants: ['scout', 'writer'],
      leadId: 'scout',
    })
  ).result;
  const sent = (
    await request<ChatRequest>(`/conversations/${group.id}/delegate`, 'POST', {
      content: 'Look into this.',
      roleIds: ['writer', 'reviewer'],
    })
  ).result;
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  await request(`/conversations/${group.id}/stop`, 'POST');
  const stopped = await waitForSnapshot(request, (snapshot) =>
    snapshot.runs.every((run) => run.status !== 'running'),
  );
  const tasks = stopped.tasks.filter((task) => task.roundId === sent.roundId);
  expect(tasks).toHaveLength(3);
  expect(tasks.every((task) => task.status === 'cancelled')).toBe(true);
  expect(stopped.delegationRounds?.find((round) => round.id === sent.roundId)?.status).toBe(
    'cancelled',
  );
  expect(turns).toHaveLength(2);
  expect(daemon.service.board.list<AgentTask>('task').length).toBe(3);
  daemon.service.board.rebuild();
  const rebuilt = (await request<Snapshot>('/snapshot')).result;
  expect(rebuilt.delegationRounds).toHaveLength(1);
  expect(rebuilt.delegationRounds?.[0].status).toBe('cancelled');
  expect(rebuilt.tasks.filter((task) => task.roundId === sent.roundId)).toHaveLength(3);
});

it('turns a failed delegate into a result without pausing the lane and still collects', async () => {
  const { daemon, request } = await setup();
  const turns = held();
  const card = makeCard(daemon);
  const group = (
    await request<Conversation>('/conversations', 'POST', {
      title: 'Failed delegate',
      participants: ['scout', 'writer', 'tracker'],
      leadId: 'scout',
      cardId: card.id,
    })
  ).result;
  await request(`/conversations/${group.id}/messages`, 'POST', { content: '@scout Plan this.' });
  await vi.waitFor(() => expect(turns).toHaveLength(1));
  const started = (await daemon.service.agentCall(
    turns[0].context.mcp.env.PITCHCREW_RUN_TOKEN,
    'delegate_round',
    {
      input: {
        delegates: [
          { roleId: 'writer', content: 'Draft three bullets.' },
          { roleId: 'tracker', content: 'Check the application status.' },
        ],
      },
    },
  )) as { round: { id: string } };
  turns[0].complete('I asked Writer and Tracker.');
  await vi.waitFor(() => expect(turns).toHaveLength(3));
  roleTurn(turns, 'writer').fail('Writer runtime crashed.');
  await waitForSnapshot(request, (snapshot) =>
    snapshot.tasks.some((task) => task.roleId === 'writer' && task.status === 'failed'),
  );
  const lane = daemon.service.queue().queues.find((queue) => queue.cardId === card.id)!;
  expect(lane).toMatchObject({ paused: false, state: 'running' });
  roleTurn(turns, 'tracker').complete('Tracker findings: no reply yet.');
  await vi.waitFor(() => expect(turns).toHaveLength(4));
  const collection = turns[3];
  expect(collection.context.delegation).toMatchObject({ part: 'collection' });
  expect(collection.context.request).toContain('Tracker findings: no reply yet.');
  expect(collection.context.request).toMatch(/writer\) — failed/i);
  expect(collection.context.request).toContain('Writer runtime crashed.');
  collection.complete('Tracker answered; Writer failed.');
  const settled = await waitForSnapshot(
    request,
    (snapshot) =>
      snapshot.delegationRounds?.find((round) => round.id === started.round.id)?.status ===
      'completed',
  );
  expect(settled.queue?.queues.find((queue) => queue.cardId === card.id)?.paused ?? false).toBe(
    false,
  );
  // The consumed failure never asks for Retry or Skip, so a later pause can resume.
  const queueId = `job:${card.id}`;
  await request(`/queue/${encodeURIComponent(queueId)}`, 'PUT', { action: 'pause' });
  const paused = daemon.service.queue().queues.find((queue) => queue.id === queueId);
  expect(paused?.tasks.some((task) => task.status === 'failed') ?? false).toBe(false);
  const resumed = await request<WorkQueue>(`/queue/${encodeURIComponent(queueId)}`, 'PUT', {
    action: 'resume',
  });
  expect(resumed.response.status).toBe(200);
  expect(resumed.result.paused).toBe(false);
});

it('collects the answer a delegate gave after asking the user, not its question', async () => {
  const { daemon, request } = await setup();
  const turns = held();
  const group = (
    await request<Conversation>('/conversations', 'POST', {
      title: 'Question round',
      participants: ['scout', 'writer'],
      leadId: 'scout',
    })
  ).result;
  const sent = (
    await request<ChatRequest>(`/conversations/${group.id}/delegate`, 'POST', {
      content: 'Compare these two offers.',
      roleIds: ['writer', 'reviewer'],
    })
  ).result;
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  const writer = roleTurn(turns, 'writer');
  const question = (
    await daemon.service.agentCall(writer.context.mcp.env.PITCHCREW_RUN_TOKEN, 'ask_user', {
      question: 'Which offer matters more to you?',
    })
  ).question as UserInputRequest;
  await waitForSnapshot(request, (snapshot) =>
    snapshot.runs.some((run) => run.roleId === 'writer' && run.status === 'waiting'),
  );
  roleTurn(turns, 'reviewer').complete('Reviewer notes: offer B pays more.');
  await waitForSnapshot(request, (snapshot) =>
    snapshot.tasks.some((task) => task.roleId === 'reviewer' && task.status === 'completed'),
  );
  // The question holds the round: no collection before the answer.
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(turns).toHaveLength(2);
  await request(`/user-input/${question.id}/answer`, 'POST', { text: 'Offer A' });
  await vi.waitFor(() => expect(turns).toHaveLength(3));
  const continuation = turns[2];
  expect(continuation.context.role.id).toBe('writer');
  // The continuation is still the delegate's turn: no nesting through it either.
  const token = continuation.context.mcp.env.PITCHCREW_RUN_TOKEN;
  await expect(
    daemon.service.agentCall(token, 'message', { roleId: 'scout', content: 'Nested.' }),
  ).rejects.toThrow('cannot message, invoke or delegate');
  expect(await daemon.service.agentCall(token, 'execution_access', {})).toMatchObject({
    delegate: true,
  });
  continuation.complete('Writer final answer: offer A fits better.');
  await vi.waitFor(() => expect(turns).toHaveLength(4));
  const collection = turns[3];
  expect(collection.context.role.id).toBe('scout');
  expect(collection.context.delegation).toMatchObject({ part: 'collection' });
  expect(collection.context.request).toContain('Writer final answer: offer A fits better.');
  expect(collection.context.request).not.toContain('Which offer matters more to you?');
  expect(collection.context.request).toMatch(/writer\) — completed/i);
  expect(collection.context.request).toContain('Reviewer notes: offer B pays more.');
  collection.complete('Both delegates reported back.');
  await waitForSnapshot(
    request,
    (snapshot) =>
      snapshot.delegationRounds?.find((round) => round.id === sent.roundId)?.status === 'completed',
  );
});
