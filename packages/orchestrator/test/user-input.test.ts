import { afterEach, expect, it, vi } from 'vitest';
import { adapters } from '@pitchcrew/adapters';
import { defaultCapabilities } from '@pitchcrew/core';
import type {
  ChatContext,
  ChatResult,
  ChatRequest,
  Conversation,
  Run,
  Snapshot,
  UserInputRequest,
} from '@pitchcrew/core';
import { setup, cleanup, waitForSnapshot } from './helpers/daemon.ts';

afterEach(cleanup);
const fixture = () => setup(19544);
const questionBody = {
  question: 'Which achievement should I emphasize?',
  reason: 'The draft needs a clear focus.',
  continuationNotes: 'I have reviewed the profile. Next, draft the opening.',
  options: [
    { id: 'accessibility', label: 'Accessibility' },
    { id: 'performance', label: 'Performance' },
  ],
};
function heldTurns() {
  const turns: { context: ChatContext; complete: () => void }[] = [];
  vi.spyOn(adapters.demo, 'chat').mockImplementation(
    (context) =>
      new Promise<ChatResult>((resolve, reject) => {
        context.signal.addEventListener('abort', () => reject(new Error('Stopped')), {
          once: true,
        });
        turns.push({ context, complete: () => resolve({ reply: 'Fixture result' }) });
      }),
  );
  return turns;
}
async function begin() {
  const fixtureData = await fixture();
  const turns = heldTurns();
  const group = (
    await fixtureData.request<Conversation>('/conversations', 'POST', {
      title: 'Question fixture',
      participants: ['scout', 'writer'],
      leadId: 'scout',
    })
  ).result;
  await fixtureData.request(`/conversations/${group.id}/messages`, 'POST', {
    content: '@writer Draft my cover letter.',
  });
  await vi.waitFor(() => expect(turns).toHaveLength(1));
  const token = turns[0].context.mcp.env.PITCHCREW_RUN_TOKEN;
  return { ...fixtureData, turns, group, token };
}
it('saves an inline question, ends execution and routes its answer only to the asking agent', async () => {
  const { daemon, request, turns, group, token } = await begin();
  const result = await daemon.service.agentCall(token, 'ask_user', questionBody);
  const question = result.question as UserInputRequest;
  await expect(
    daemon.service.agentCall(token, 'notify_user', { kind: 'message', content: 'More work' }),
  ).rejects.toThrow('waiting for user input');
  const waiting = await waitForSnapshot(request, (s) => s.runs[0].status === 'waiting');
  expect(waiting.chatRequests?.[0].deliveries[0].status).toBe('waiting');
  expect(waiting.messages.find((m) => m.id === question.messageId)?.userInput).toEqual({
    id: question.id,
    kind: 'question',
  });
  expect(daemon.service.controllers.size).toBe(0);
  expect((await request(`/conversations/${group.id}/continue`, 'POST', {})).response.status).toBe(
    400,
  );
  await request(`/conversations/${group.id}/messages`, 'POST', {
    content: '@scout Independent research.',
  });
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  expect(turns[1].context.role.id).toBe('scout');
  turns[1].complete();
  const answered = await request<ChatRequest>(`/user-input/${question.id}/answer`, 'POST', {
    selected: ['accessibility'],
    text: 'Mention the audit.',
  });
  expect(answered.response.status).toBe(202);
  expect(answered.result.deliveries.map((d) => d.roleId)).toEqual(['writer']);
  await vi.waitFor(() => expect(turns).toHaveLength(3));
  expect(turns[2].context.request).toContain('Answer: Accessibility\nMention the audit.');
  expect(turns[2].context.request).toContain('Draft my cover letter.');
  expect(turns[2].context.request).toContain('I have reviewed the profile.');
  turns[2].complete();
  const completed = await waitForSnapshot(request, (s) =>
    s.runs.every((run) => run.status === 'completed'),
  );
  expect(completed.userInputs?.[0].status).toBe('answered');
  expect(
    completed.messages.find((m) => m.id === completed.userInputs?.[0].answerMessageId),
  ).toMatchObject({
    from: 'user',
    to: 'writer',
    threadId: group.id,
    content: 'Accessibility\nMention the audit.',
  });
  expect(
    (await request(`/user-input/${question.id}/answer`, 'POST', { text: 'Again' })).response.status,
  ).toBe(400);
  daemon.service.board.rebuild();
  expect(daemon.service.board.list<UserInputRequest>('user_input')[0].answer?.text).toBe(
    'Mention the audit.',
  );
});
it('holds dependent follow-ups through successive questions and releases them after the last answer', async () => {
  const { daemon, request, turns, token } = await begin();
  await daemon.service.agentCall(token, 'invoke', {
    roleId: 'tracker',
    content: 'Track the result.',
  });
  const first = (await daemon.service.agentCall(token, 'ask_user', questionBody))
    .question as UserInputRequest;
  await waitForSnapshot(request, (s) => s.runs[0].status === 'waiting');
  expect(turns).toHaveLength(1);
  await request(`/user-input/${first.id}/answer`, 'POST', { text: 'Accessibility' });
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  const second = (
    await daemon.service.agentCall(turns[1].context.mcp.env.PITCHCREW_RUN_TOKEN, 'ask_user', {
      question: 'Which project?',
    })
  ).question as UserInputRequest;
  await waitForSnapshot(request, (s) => s.runs.every((run) => run.status === 'waiting'));
  expect(turns).toHaveLength(2);
  await request(`/user-input/${second.id}/answer`, 'POST', { text: 'Scheduling' });
  await vi.waitFor(() => expect(turns).toHaveLength(3));
  expect(turns[2].context.request?.match(/Continue your interrupted task/g)).toHaveLength(1);
  turns[2].complete();
  await vi.waitFor(() => expect(turns).toHaveLength(4));
  expect(turns[3].context.role.id).toBe('tracker');
  turns[3].complete();
  await waitForSnapshot(
    request,
    (s) =>
      s.runs.every((run) => run.status === 'completed') &&
      s.tasks.every((task) => task.status === 'completed'),
  );
});
it('validates choices and supports multiple choices and custom answers', async () => {
  const { daemon, request, token } = await begin();
  const q = (await daemon.service.agentCall(token, 'ask_user', questionBody))
    .question as UserInputRequest;
  for (const answer of [
    {},
    { selected: ['unknown'] },
    { selected: ['accessibility', 'performance'] },
    { selected: ['accessibility', 'accessibility'] },
  ])
    expect((await request(`/user-input/${q.id}/answer`, 'POST', answer)).response.status).toBe(400);
  expect(daemon.service.board.get<UserInputRequest>('user_input', q.id).status).toBe('pending');
});
it('keeps pending questions and blocked tasks across restart recovery and event replay', async () => {
  const { daemon, request, token, turns } = await begin();
  await daemon.service.agentCall(token, 'invoke', {
    roleId: 'tracker',
    content: 'Use the finished draft.',
  });
  const q = (
    await daemon.service.agentCall(token, 'ask_user', { ...questionBody, multiSelect: true })
  ).question as UserInputRequest;
  await waitForSnapshot(request, (s) => s.runs[0].status === 'waiting');
  await daemon.service.initialize(false);
  daemon.service.board.rebuild();
  const recovered = (await request<Snapshot>('/snapshot')).result;
  expect(recovered.userInputs?.[0].status).toBe('pending');
  expect(recovered.chatRequests?.[0].deliveries[0].status).toBe('waiting');
  expect(recovered.tasks[0].status).toBe('queued');
  await request(`/user-input/${q.id}/answer`, 'POST', {
    selected: ['accessibility', 'performance'],
  });
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  expect(turns[1].context.request).toContain('Answer: Accessibility\nPerformance');
  turns[1].complete();
  await vi.waitFor(() => expect(turns).toHaveLength(3));
  turns[2].complete();
});
it('cancels questions and dependent work when stopped or when membership is removed', async () => {
  const { daemon, request, group, token } = await begin();
  await daemon.service.agentCall(token, 'invoke', { roleId: 'tracker', content: 'Track it.' });
  const q = (await daemon.service.agentCall(token, 'ask_user', questionBody))
    .question as UserInputRequest;
  await waitForSnapshot(request, (s) => s.runs[0].status === 'waiting');
  await request(`/conversations/${group.id}`, 'PUT', { participants: ['scout'], leadId: 'scout' });
  expect(daemon.service.board.get<UserInputRequest>('user_input', q.id).status).toBe('cancelled');
  expect(
    (await request(`/user-input/${q.id}/answer`, 'POST', { text: 'Too late' })).response.status,
  ).toBe(400);
  const snapshot = await waitForSnapshot(request, (s) => s.tasks[0].status === 'cancelled');
  expect(snapshot.runs[0].status).toBe('cancelled');
});
it('lets the user cancel a question without granting approvals or waking dependent work', async () => {
  const { daemon, request, token } = await begin();
  await daemon.service.agentCall(token, 'invoke', { roleId: 'tracker', content: 'Track it.' });
  const q = (await daemon.service.agentCall(token, 'ask_user', questionBody))
    .question as UserInputRequest;
  await waitForSnapshot(request, (s) => s.runs[0].status === 'waiting');
  expect((await request(`/user-input/${q.id}/cancel`, 'POST', {})).response.status).toBe(200);
  const snapshot = await waitForSnapshot(request, (s) => s.tasks[0].status === 'cancelled');
  expect(snapshot.userInputs?.[0].status).toBe('cancelled');
  expect(snapshot.approvals).toHaveLength(0);
  expect(snapshot.computerApprovals).toHaveLength(0);
});
it('routes DM questions into a writable parent while preserving the original continuation scope', async () => {
  const { daemon, request, turns, token, group } = await begin();
  await daemon.service.agentCall(token, 'invoke', {
    roleId: 'scout',
    content: 'Find supporting evidence.',
  });
  turns[0].complete();
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  const dm = turns[1].context.conversation!;
  expect(dm.kind).toBe('agent_dm');
  const q = (
    await daemon.service.agentCall(turns[1].context.mcp.env.PITCHCREW_RUN_TOKEN, 'ask_user', {
      question: 'Which project should I research?',
    })
  ).question as UserInputRequest;
  expect(q.threadId).toBe(group.id);
  expect(q.sourceThreadId).toBe(dm.id);
  await waitForSnapshot(request, (s) => s.runs.some((run) => run.status === 'waiting'));
  await request(`/user-input/${q.id}/answer`, 'POST', { text: 'Scheduling project' });
  await vi.waitFor(() => expect(turns).toHaveLength(3));
  expect(turns[2].context.conversation?.id).toBe(dm.id);
  expect(turns[2].context.request).toContain('Scheduling project');
  turns[2].complete();
  const s = await waitForSnapshot(request, (s) =>
    s.runs.every((run) => run.status === 'completed'),
  );
  expect(s.messages.filter((m) => m.threadId === dm.id && m.from === 'user')).toHaveLength(0);
});
it('keeps a failed continuation recoverable without losing the saved answer', async () => {
  const { daemon, request, token, turns } = await begin();
  const q = (await daemon.service.agentCall(token, 'ask_user', questionBody))
    .question as UserInputRequest;
  await waitForSnapshot(request, (s) => s.runs[0].status === 'waiting');
  const answer = (
    await request<ChatRequest>(`/user-input/${q.id}/answer`, 'POST', { text: 'Accessibility' })
  ).result;
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  const resumed = daemon.service.board.list<Run>('run').find((r) => r.requestId === answer.id)!;
  daemon.service.controllers.get(resumed.id)!.abort();
  await waitForSnapshot(
    request,
    (s) => s.chatRequests?.find((r) => r.id === answer.id)?.deliveries[0].status === 'paused',
  );
  expect(daemon.service.board.get<UserInputRequest>('user_input', q.id).answer?.text).toBe(
    'Accessibility',
  );
  await request(`/chat-requests/${answer.id}`, 'PUT', { action: 'resume' });
  await vi.waitFor(() => expect(turns).toHaveLength(3));
  turns[2].complete();
  await waitForSnapshot(
    request,
    (s) => s.chatRequests?.find((r) => r.id === answer.id)?.deliveries[0].status === 'completed',
  );
});
it('ends a workflow without applying a partial result and resumes its original workflow after answering', async () => {
  const { daemon, request } = await fixture();
  await daemon.service.saveProfile(
    'experience.md',
    'Fictional experience building accessible interfaces.',
  );
  const contexts: import('@pitchcrew/core').RunContext[] = [];
  vi.spyOn(adapters.demo, 'run').mockImplementation((context) => {
    contexts.push(context);
    if (contexts.length > 1)
      return Promise.resolve({ role: 'scout', fit: 80, reasons: ['Fixture assessment'] });
    return new Promise((_resolve, reject) =>
      context.signal.addEventListener('abort', () => reject(new Error('Stopped')), { once: true }),
    );
  });
  const card = daemon.service.createCard({
    company: 'Fixture Studio',
    title: 'Engineer',
    description: 'Accessible interfaces.',
  });
  const run = await daemon.service.startRun(card.id, 'scout');
  await vi.waitFor(() => expect(contexts).toHaveLength(1));
  const q = (
    await daemon.service.agentCall(contexts[0].mcp.env.PITCHCREW_RUN_TOKEN, 'ask_user', {
      question: 'Which location?',
    })
  ).question as UserInputRequest;
  await waitForSnapshot(request, (s) => s.runs[0].status === 'waiting');
  expect(daemon.service.board.get<import('@pitchcrew/core').Card>('card', card.id).fit).toBeNull();
  expect(
    daemon.service.board.get<import('@pitchcrew/core').Card>('card', card.id).owner,
  ).toBeNull();
  await request(`/user-input/${q.id}/answer`, 'POST', { text: 'Remote' });
  await waitForSnapshot(request, (s) => s.runs.every((r) => r.status === 'completed'));
  expect(contexts[1].request).toContain('Answer: Remote');
  expect(daemon.service.board.get<Run>('run', run.id).status).toBe('completed');
  expect(daemon.service.board.get<import('@pitchcrew/core').Card>('card', card.id).fit).toBe(80);
});
it('cancels the full blocked continuation chain when a later question is cancelled', async () => {
  const { daemon, request, token, turns } = await begin();
  await daemon.service.agentCall(token, 'invoke', {
    roleId: 'tracker',
    content: 'Use the result.',
  });
  const first = (await daemon.service.agentCall(token, 'ask_user', questionBody))
    .question as UserInputRequest;
  await waitForSnapshot(request, (s) => s.runs[0].status === 'waiting');
  await request(`/user-input/${first.id}/answer`, 'POST', { text: 'Accessibility' });
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  const second = (
    await daemon.service.agentCall(turns[1].context.mcp.env.PITCHCREW_RUN_TOKEN, 'ask_user', {
      question: 'Which project?',
    })
  ).question as UserInputRequest;
  await waitForSnapshot(request, (s) => s.runs.every((r) => r.status === 'waiting'));
  await request(`/user-input/${second.id}/cancel`, 'POST', {});
  const cancelled = await waitForSnapshot(request, (s) => s.tasks[0].status === 'cancelled');
  expect(cancelled.runs.every((r) => r.status === 'cancelled')).toBe(true);
  expect(cancelled.userInputs?.every((q) => q.status === 'cancelled')).toBe(true);
});
it('restores a pending question after a real daemon restart without starting dependent work', async () => {
  const { daemon, directory, request, token, turns } = await begin();
  await daemon.service.agentCall(token, 'invoke', {
    roleId: 'tracker',
    content: 'Use the completed draft.',
  });
  const q = (await daemon.service.agentCall(token, 'ask_user', questionBody))
    .question as UserInputRequest;
  await waitForSnapshot(request, (s) => s.runs[0].status === 'waiting');
  await daemon.close();
  const { createDaemon } = await import('../src/server.ts');
  const { resources } = await import('./helpers/daemon.ts');
  const restored = await createDaemon({ directory, port: 19544, dev: true, seedSkills: false });
  resources.find((resource) => resource.daemon === daemon)!.daemon = restored;
  expect((await restored.service.snapshot()).userInputs?.[0].status).toBe('pending');
  expect(restored.service.board.list<import('@pitchcrew/core').AgentTask>('task')[0].status).toBe(
    'queued',
  );
  expect(turns).toHaveLength(1);
  restored.service.answerUserQuestion(q.id, { text: 'Accessibility' });
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  turns[1].complete();
  await vi.waitFor(() => expect(turns).toHaveLength(3));
  expect(turns[2].context.role.id).toBe('tracker');
  turns[2].complete();
});
it('rechecks delegation permissions after successive questions and keeps the chain’s existing follow-up budget', async () => {
  const { daemon, request, turns, token } = await begin();
  await daemon.service.agentCall(token, 'invoke', {
    roleId: 'scout',
    content: 'Find supporting evidence.',
  });
  turns[0].complete();
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  const first = (
    await daemon.service.agentCall(
      turns[1].context.mcp.env.PITCHCREW_RUN_TOKEN,
      'ask_user',
      questionBody,
    )
  ).question as UserInputRequest;
  await waitForSnapshot(request, (s) => s.runs.some((run) => run.status === 'waiting'));
  const answer = (
    await request<ChatRequest>(`/user-input/${first.id}/answer`, 'POST', { text: 'Accessibility' })
  ).result;
  await vi.waitFor(() => expect(turns).toHaveLength(3));
  const originalRun = daemon.service.board.get<Run>('run', first.runId);
  expect(answer.rootRunId).toBe(originalRun.rootRunId);
  const second = (
    await daemon.service.agentCall(turns[2].context.mcp.env.PITCHCREW_RUN_TOKEN, 'ask_user', {
      question: 'Which project?',
    })
  ).question as UserInputRequest;
  await waitForSnapshot(request, (s) =>
    s.runs.filter((run) => run.roleId === 'scout').every((run) => run.status === 'waiting'),
  );
  const writer = daemon.service.board.get<import('@pitchcrew/core').Role>('role', 'writer');
  await daemon.service.configureRole('writer', {
    ...writer,
    capabilities: { ...defaultCapabilities, ...writer.capabilities, invokeAgents: false },
  });
  const rejected = await request(`/user-input/${second.id}/answer`, 'POST', { text: 'Scheduling' });
  expect(rejected.response.status).toBe(400);
  expect(daemon.service.board.get<UserInputRequest>('user_input', second.id).status).toBe(
    'pending',
  );
});
it('cancels a later pending question when the original waiting request is removed', async () => {
  const { daemon, request, turns, token } = await begin();
  const first = (await daemon.service.agentCall(token, 'ask_user', questionBody))
    .question as UserInputRequest;
  const original = daemon.service.board.get<Run>('run', first.runId);
  await waitForSnapshot(request, (s) => s.runs[0].status === 'waiting');
  await request(`/user-input/${first.id}/answer`, 'POST', { text: 'Accessibility' });
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  const second = (
    await daemon.service.agentCall(turns[1].context.mcp.env.PITCHCREW_RUN_TOKEN, 'ask_user', {
      question: 'Which project?',
    })
  ).question as UserInputRequest;
  await waitForSnapshot(request, (s) => s.runs.every((run) => run.status === 'waiting'));
  await request(`/chat-requests/${original.requestId}`, 'PUT', { action: 'remove' });
  expect(daemon.service.board.get<UserInputRequest>('user_input', second.id).status).toBe(
    'cancelled',
  );
  expect(
    (await request(`/user-input/${second.id}/answer`, 'POST', { text: 'Too late' })).response
      .status,
  ).toBe(400);
});
