import { afterEach, expect, it, vi } from 'vitest';
import type {
  ChatContext,
  ChatRequest,
  Conversation,
  Snapshot,
  ChatResult,
  AgentMemory,
} from '@pitchcrew/core';
import { adapters } from '@pitchcrew/adapters';
import { setup, cleanup, waitForSnapshot } from './helpers/daemon.ts';

afterEach(cleanup);
function heldTurns() {
  const turns: { context: ChatContext; complete: (reply?: string) => void }[] = [];
  vi.spyOn(adapters.demo, 'chat').mockImplementation(
    (context) =>
      new Promise<ChatResult>((resolve, reject) => {
        context.signal.addEventListener('abort', () => reject(new Error('Run cancelled.')), {
          once: true,
        });
        turns.push({ context, complete: (reply = 'Fixture reply') => resolve({ reply }) });
      }),
  );
  return turns;
}
const fixture = () => setup(19541);
const body = { title: 'Application planning', participants: ['scout', 'writer'], leadId: 'scout' };
it('migrates history without rewriting messages and supports unlimited group membership with targeted mentions', async () => {
  const { request, daemon } = await fixture();
  daemon.service.addMessage('crew', 'scout', 'writer', 'Historical handoff.', null, null);
  daemon.service.board.rebuild();
  const before = (await request<Snapshot>('/snapshot')).result;
  expect(before.conversations?.find((item) => item.id === 'crew')).toMatchObject({
    kind: 'history',
    title: 'Crew history',
  });
  expect(
    (await request('/conversations/crew/messages', 'POST', { content: 'Reply' })).response.status,
  ).toBe(400);
  const turns = heldTurns();
  const group = (
    await request<Conversation>('/conversations', 'POST', {
      ...body,
      participants: before.roles.map((role) => role.id),
    })
  ).result;
  expect(group.participants).toHaveLength(7);
  const sent = await request<ChatRequest>(`/conversations/${group.id}/messages`, 'POST', {
    content: '@scout Check this.',
  });
  expect(sent.response.status).toBe(202);
  await vi.waitFor(() => expect(turns).toHaveLength(1));
  expect(turns[0].context.conversation?.participants).toHaveLength(7);
  expect(turns[0].context.role.id).toBe('scout');
  turns[0].complete();
  await waitForSnapshot(
    request,
    (snapshot) => snapshot.chatRequests?.[0].deliveries[0].status === 'completed',
  );
  const all = await request<ChatRequest>(`/conversations/${group.id}/messages`, 'POST', {
    content: 'Consider this together.',
  });
  expect(all.result.deliveries).toHaveLength(7);
  await vi.waitFor(() => expect(turns).toHaveLength(8));
  for (const turn of turns.slice(1)) turn.complete();
  await waitForSnapshot(request, (snapshot) =>
    snapshot.runs.every((run) => run.status === 'completed'),
  );
  expect(
    daemon.service.board
      .list<import('@pitchcrew/core').ChatMessage>('message')
      .find((message) => message.content === 'Historical handoff.')?.threadId,
  ).toBe('crew');
});
it('queues across conversations, edits and promotes waiting input, and withholds undelivered input from the runtime', async () => {
  const { request } = await fixture();
  const turns = heldTurns();
  const first = (
    await request<Conversation>('/conversations', 'POST', {
      title: 'First topic',
      participants: ['scout'],
    })
  ).result;
  const second = (
    await request<Conversation>('/conversations', 'POST', {
      title: 'Second topic',
      participants: ['scout'],
    })
  ).result;
  await request(`/conversations/${first.id}/messages`, 'POST', { content: 'First request.' });
  await vi.waitFor(() => expect(turns).toHaveLength(1));
  const waiting = (
    await request<ChatRequest>(`/conversations/${second.id}/messages`, 'POST', {
      content: 'Waiting request.',
    })
  ).result;
  const promoted = (
    await request<ChatRequest>(`/conversations/${first.id}/messages`, 'POST', {
      content: 'Urgent request.',
    })
  ).result;
  await request(`/chat-requests/${waiting.id}`, 'PUT', {
    action: 'edit',
    content: 'Edited waiting request.',
  });
  await request(`/chat-requests/${promoted.id}`, 'PUT', { action: 'next' });
  expect(turns).toHaveLength(1);
  turns[0].complete();
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  expect(turns[1].context.request).toBe('Urgent request.');
  expect(
    turns[1].context.messages.some((message) => message.content.includes('waiting request')),
  ).toBe(false);
  turns[1].complete();
  await vi.waitFor(() => expect(turns).toHaveLength(3));
  expect(turns[2].context.request).toBe('Edited waiting request.');
  expect(turns[2].context.messages.some((message) => message.content === 'First request.')).toBe(
    false,
  );
  turns[2].complete();
  await waitForSnapshot(request, (snapshot) =>
    snapshot.runs.every((run) => run.status === 'completed'),
  );
});
it('removal revokes active tools and cancels deliveries without stopping independent participants', async () => {
  const { request, daemon } = await fixture();
  const turns = heldTurns();
  const group = (await request<Conversation>('/conversations', 'POST', body)).result;
  await request(`/conversations/${group.id}/messages`, 'POST', { content: 'Work together.' });
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  const writer = turns.find((turn) => turn.context.role.id === 'writer')!;
  const update = await request(`/conversations/${group.id}`, 'PUT', { participants: ['scout'] });
  expect(update.response.status).toBe(200);
  expect(writer.context.signal.aborted).toBe(true);
  await expect(
    daemon.service.agentCall(writer.context.mcp.env.PITCHCREW_RUN_TOKEN, 'messages', {}),
  ).rejects.toThrow(/expired|invalid|removed/);
  const scout = turns.find((turn) => turn.context.role.id === 'scout')!;
  expect(scout.context.signal.aborted).toBe(false);
  scout.complete();
  const snapshot = await waitForSnapshot(request, (snapshot) =>
    snapshot.runs.every((run) => run.status !== 'running'),
  );
  expect(
    snapshot.chatRequests?.[0].deliveries.find((delivery) => delivery.roleId === 'writer')?.status,
  ).toBe('cancelled');
});
it('scopes memory to its agent, preserves sources and applies edits and deletion on recall', async () => {
  const { request, daemon } = await fixture();
  const turns = heldTurns();
  await request('/conversations/scout/messages', 'POST', {
    content: 'Remember that I prefer remote work.',
  });
  await request('/conversations/writer/messages', 'POST', { content: 'Writer context.' });
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  const scout = turns.find((turn) => turn.context.role.id === 'scout')!;
  const writer = turns.find((turn) => turn.context.role.id === 'writer')!;
  const token = scout.context.mcp.env.PITCHCREW_RUN_TOKEN;
  const { memory } = (await daemon.service.agentCall(token, 'save_memory', {
    content: 'User prefers remote work.',
    tags: ['preferences'],
  })) as { memory: AgentMemory };
  expect(memory.source).toMatchObject({ threadId: 'scout', messageId: expect.any(String) });
  expect(
    (
      await daemon.service.agentCall(
        writer.context.mcp.env.PITCHCREW_RUN_TOKEN,
        'recall_memory',
        {},
      )
    ).memories,
  ).toEqual([]);
  await request(`/memories/${memory.id}`, 'PUT', {
    content: 'User prefers hybrid work.',
    tags: ['preferences'],
  });
  expect((await daemon.service.agentCall(token, 'recall_memory', {})).memories).toEqual([
    expect.objectContaining({ content: 'User prefers hybrid work.' }),
  ]);
  await request(`/memories/${memory.id}`, 'DELETE');
  expect((await daemon.service.agentCall(token, 'recall_memory', {})).memories).toEqual([]);
  scout.complete();
  writer.complete();
  await waitForSnapshot(request, (snapshot) =>
    snapshot.runs.every((run) => run.status === 'completed'),
  );
  expect(daemon.service.board.get<AgentMemory>('agent_memory', memory.id).deleted).toBe(true);
});
it('persists agent-created groups and user-visible read-only DMs without resetting the follow-up budget', async () => {
  const { request, daemon } = await fixture();
  const turns = heldTurns();
  await request('/conversations/scout/messages', 'POST', { content: 'Coordinate with Writer.' });
  await vi.waitFor(() => expect(turns).toHaveLength(1));
  const token = turns[0].context.mcp.env.PITCHCREW_RUN_TOKEN;
  const created = (await daemon.service.agentCall(token, 'create_group', {
    title: 'Agent-created work',
    participants: ['writer'],
  })) as { conversation: Conversation };
  expect(created.conversation.leadId).toBe('scout');
  await daemon.service.agentCall(token, 'invite_agent', {
    conversationId: created.conversation.id,
    roleId: 'reviewer',
  });
  const delegated = (await daemon.service.agentCall(token, 'message', {
    roleId: 'writer',
    content: 'Please assess the draft.',
  })) as { task: import('@pitchcrew/core').AgentTask };
  const dm = daemon.service.board.get<Conversation>('conversation', delegated.task.threadId);
  expect(dm).toMatchObject({
    kind: 'agent_dm',
    participants: ['scout', 'writer'],
    parentId: 'scout',
  });
  expect(
    (await request(`/conversations/${dm.id}/messages`, 'POST', { content: 'User interruption' }))
      .response.status,
  ).toBe(400);
  for (let i = 0; i < 5; i++)
    await daemon.service.agentCall(token, 'message', {
      roleId: 'writer',
      content: `Follow-up ${i}`,
    });
  await expect(
    daemon.service.agentCall(token, 'message', { roleId: 'writer', content: 'Too many.' }),
  ).rejects.toThrow('six follow-up limit');
  await request('/conversations/scout/stop', 'POST');
  await waitForSnapshot(request, (snapshot) =>
    snapshot.runs.every((run) => run.status !== 'running'),
  );
  expect(
    daemon.service.board
      .list<import('@pitchcrew/core').AgentTask>('task')
      .every((task) => task.status === 'cancelled'),
  ).toBe(true);
});
it('summarizes before continuing, trims the next runtime context and retains original source messages', async () => {
  const { request, daemon } = await fixture();
  const contexts: ChatContext[] = [];
  vi.spyOn(adapters.demo, 'chat').mockImplementation(async (context) => {
    contexts.push(context);
    return {
      reply: context.request?.startsWith('Create a concise continuation')
        ? 'Decision: remote roles. Remaining: compare two jobs. Sources: earlier user request.'
        : 'Fixture result.',
    };
  });
  await request('/conversations/scout/messages', 'POST', {
    content: 'Original remote-work request.',
  });
  await waitForSnapshot(
    request,
    (snapshot) => snapshot.chatRequests?.[0].deliveries[0].status === 'completed',
  );
  expect((await request('/conversations/scout/continue', 'POST')).response.status).toBe(202);
  const snapshot = await waitForSnapshot(
    request,
    (snapshot) =>
      (snapshot.chatRequests?.length ?? 0) === 3 &&
      snapshot.chatRequests!.every((entry) =>
        entry.deliveries.every((delivery) => delivery.status === 'completed'),
      ),
  );
  expect(contexts).toHaveLength(3);
  expect(
    contexts[2].messages.some((message) => message.content === 'Original remote-work request.'),
  ).toBe(false);
  expect(
    contexts[2].messages.some((message) => message.content.includes('Continuation summary')),
  ).toBe(true);
  expect(
    snapshot.messages.some((message) => message.content === 'Original remote-work request.'),
  ).toBe(true);
  daemon.service.board.rebuild();
  expect(
    daemon.service.board.get<Conversation>('conversation', 'scout').summary?.content,
  ).toContain('Remaining');
});
it('archives without stopping work and restores the conversation when a reply arrives', async () => {
  const { request } = await fixture();
  const turns = heldTurns();
  await request('/conversations/scout/messages', 'POST', { content: 'Work continues.' });
  await vi.waitFor(() => expect(turns).toHaveLength(1));
  await request('/conversations/scout', 'PUT', { archived: true, pinned: true });
  expect(turns[0].context.signal.aborted).toBe(false);
  turns[0].complete();
  const snapshot = await waitForSnapshot(request, (snapshot) =>
    snapshot.runs.every((run) => run.status === 'completed'),
  );
  expect(snapshot.conversations?.find((item) => item.id === 'scout')).toMatchObject({
    archived: false,
    pinned: true,
  });
});
it('recovers queued user input as paused and preserves event replay', async () => {
  const { request, daemon } = await fixture();
  daemon.service.board.record(
    'chat_request',
    {
      id: 'fixture-request',
      threadId: 'scout',
      messageId: 'fixture-message',
      content: 'Waiting input',
      attachments: [],
      createdAt: new Date().toISOString(),
      order: Date.now(),
      deliveries: [{ roleId: 'scout', status: 'queued', runId: null, error: '' }],
    },
    'user',
    'Fixture queue',
  );
  await daemon.service.initialize(false);
  daemon.service.board.rebuild();
  const snapshot = (await request<Snapshot>('/snapshot')).result;
  expect(snapshot.chatRequests?.[0].deliveries[0].status).toBe('paused');
  expect(snapshot.conversations?.find((item) => item.id === 'scout')).toBeDefined();
});
it('stops a delegated DM branch from its group without cancelling independent participants', async () => {
  const { request, daemon } = await fixture();
  const turns = heldTurns();
  const group = (await request<Conversation>('/conversations', 'POST', body)).result;
  await request(`/conversations/${group.id}/messages`, 'POST', { content: 'Work together.' });
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  const scout = turns.find((turn) => turn.context.role.id === 'scout')!;
  await daemon.service.agentCall(scout.context.mcp.env.PITCHCREW_RUN_TOKEN, 'message', {
    roleId: 'tracker',
    content: 'Check the tracking plan.',
  });
  scout.complete();
  await vi.waitFor(() => expect(turns).toHaveLength(3));
  const tracker = turns.find((turn) => turn.context.role.id === 'tracker')!;
  const writer = turns.find((turn) => turn.context.role.id === 'writer')!;
  await request(`/conversations/${group.id}/stop`, 'POST', { roleId: 'tracker' });
  expect(tracker.context.signal.aborted).toBe(true);
  expect(writer.context.signal.aborted).toBe(false);
  writer.complete();
  await waitForSnapshot(request, (snapshot) =>
    snapshot.runs.every((run) => run.status !== 'running'),
  );
});
it('interrupts only the requested branch and prioritizes its new turn over older queued input', async () => {
  const { request } = await fixture();
  const turns = heldTurns();
  const group = (await request<Conversation>('/conversations', 'POST', body)).result;
  await request(`/conversations/${group.id}/messages`, 'POST', { content: 'Work together.' });
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  await request(`/conversations/${group.id}/messages`, 'POST', {
    content: '@scout Later request.',
  });
  await request(`/conversations/${group.id}/messages`, 'POST', {
    content: '@scout Urgent correction.',
    intent: 'interrupt',
  });
  const scout = turns.find((turn) => turn.context.role.id === 'scout')!;
  const writer = turns.find((turn) => turn.context.role.id === 'writer')!;
  expect(scout.context.signal.aborted).toBe(true);
  expect(writer.context.signal.aborted).toBe(false);
  await vi.waitFor(() => expect(turns).toHaveLength(3));
  expect(turns[2].context.request).toBe('@scout Urgent correction.');
  turns[2].complete();
  await vi.waitFor(() => expect(turns).toHaveLength(4));
  expect(turns[3].context.request).toBe('@scout Later request.');
  turns[3].complete();
  writer.complete();
  await waitForSnapshot(request, (snapshot) =>
    snapshot.runs.every((run) => run.status !== 'running'),
  );
});
it('resumes only unfinished group deliveries after Stop group', async () => {
  const { request } = await fixture();
  const turns = heldTurns();
  const group = (await request<Conversation>('/conversations', 'POST', body)).result;
  const sent = (
    await request<ChatRequest>(`/conversations/${group.id}/messages`, 'POST', {
      content: 'Work together.',
    })
  ).result;
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  turns.find((turn) => turn.context.role.id === 'scout')!.complete();
  await waitForSnapshot(
    request,
    (snapshot) =>
      snapshot.chatRequests?.[0].deliveries.find((entry) => entry.roleId === 'scout')?.status ===
      'completed',
  );
  await request(`/conversations/${group.id}/stop`, 'POST');
  await waitForSnapshot(request, (snapshot) =>
    snapshot.runs.every((run) => run.status !== 'running'),
  );
  await request(`/chat-requests/${sent.id}`, 'PUT', { action: 'resume' });
  await vi.waitFor(() => expect(turns).toHaveLength(3));
  expect(turns[2].context.role.id).toBe('writer');
  turns[2].complete();
  await waitForSnapshot(
    request,
    (snapshot) =>
      snapshot.chatRequests?.[0].deliveries.every((entry) => entry.status === 'completed') === true,
  );
});
it('keeps retired participants searchable and archivable while allowing eligible group agents to respond', async () => {
  const { request } = await fixture();
  const group = (await request<Conversation>('/conversations', 'POST', body)).result;
  expect((await request('/roles/writer/retire', 'POST')).response.status).toBe(200);
  expect(
    (await request(`/conversations/${group.id}`, 'PUT', { pinned: true })).response.status,
  ).toBe(200);
  expect((await request('/conversations/writer', 'PUT', { archived: true })).response.status).toBe(
    200,
  );
  const sent = await request<ChatRequest>(`/conversations/${group.id}/messages`, 'POST', {
    content: 'Only eligible members should respond.',
  });
  expect(sent.response.status).toBe(202);
  expect(sent.result.deliveries.map((entry) => entry.roleId)).toEqual(['scout']);
  await waitForSnapshot(
    request,
    (snapshot) => snapshot.chatRequests?.[0].deliveries[0].status === 'completed',
  );
});
it('retries failed deliveries only after a user action and can dismiss a failed request', async () => {
  const { request } = await fixture();
  const chat = vi
    .spyOn(adapters.demo, 'chat')
    .mockRejectedValueOnce(new Error('Fictional runtime failure.'))
    .mockResolvedValue({ reply: 'Recovered reply.' });
  const sent = (
    await request<ChatRequest>('/conversations/scout/messages', 'POST', {
      content: 'Keep my request.',
    })
  ).result;
  await waitForSnapshot(
    request,
    (snapshot) => snapshot.chatRequests?.[0].deliveries[0].status === 'failed',
  );
  expect(chat).toHaveBeenCalledOnce();
  await request(`/chat-requests/${sent.id}`, 'PUT', { action: 'resume' });
  const recovered = await waitForSnapshot(
    request,
    (snapshot) => snapshot.chatRequests?.[0].deliveries[0].status === 'completed',
  );
  expect(
    recovered.messages.filter((message) => message.content === 'Keep my request.'),
  ).toHaveLength(1);
  chat.mockRejectedValueOnce(new Error('Second fictional failure.'));
  const failed = (
    await request<ChatRequest>('/conversations/scout/messages', 'POST', {
      content: 'Dismiss this failure.',
    })
  ).result;
  await waitForSnapshot(
    request,
    (snapshot) =>
      snapshot.chatRequests?.find((entry) => entry.id === failed.id)?.deliveries[0].status ===
      'failed',
  );
  expect(
    (await request<ChatRequest>(`/chat-requests/${failed.id}`, 'PUT', { action: 'remove' })).result
      .deliveries[0].status,
  ).toBe('cancelled');
});
it('does not absorb input queued during summarization into the summary sources', async () => {
  const { request } = await fixture();
  const turns = heldTurns();
  await request('/conversations/scout/messages', 'POST', { content: 'Original request.' });
  await vi.waitFor(() => expect(turns).toHaveLength(1));
  turns[0].complete();
  await waitForSnapshot(request, (snapshot) =>
    snapshot.runs.every((run) => run.status === 'completed'),
  );
  await request('/conversations/scout/continue', 'POST');
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  const future = (
    await request<ChatRequest>('/conversations/scout/messages', 'POST', {
      content: 'A new constraint during summarization.',
      attachments: [
        { name: 'constraint.md', data: Buffer.from('Future context').toString('base64') },
      ],
    })
  ).result;
  turns[1].complete('Original request completed. Continue the remaining planning.');
  await vi.waitFor(() => expect(turns).toHaveLength(3));
  expect(turns[2].context.request).toBe(future.content);
  expect(turns[2].context.attachments).toHaveLength(1);
  const snapshot = (await request<Snapshot>('/snapshot')).result;
  expect(
    snapshot.conversations?.find((item) => item.id === 'scout')?.summary?.sources,
  ).not.toContain(future.messageId);
  turns[2].complete();
  await vi.waitFor(() => expect(turns).toHaveLength(4));
  turns[3].complete();
  await waitForSnapshot(request, (snapshot) =>
    snapshot.runs.every((run) => run.status === 'completed'),
  );
});
it('dispatches an older ready routine before newer user input when its agent becomes free', async () => {
  const { request } = await fixture();
  const turns = heldTurns();
  await request('/conversations/scout/messages', 'POST', { content: 'Current work.' });
  await vi.waitFor(() => expect(turns).toHaveLength(1));
  const scheduled = await request('/routines', 'POST', {
    name: 'Earlier scheduled work',
    roleId: 'scout',
    content: 'Scheduled request.',
    cardId: null,
    enabled: true,
    startAt: new Date(Date.now() - 2000).toISOString(),
    timezone: 'UTC',
  });
  expect(scheduled.response.status).toBe(201);
  await request('/conversations/scout/messages', 'POST', { content: 'Later queued request.' });
  turns[0].complete();
  await vi.waitFor(() => expect(turns).toHaveLength(2), { timeout: 3000 });
  expect(turns[1].context.request).toBe('Scheduled request.');
  turns[1].complete();
  await vi.waitFor(() => expect(turns).toHaveLength(3));
  expect(turns[2].context.request).toBe('Later queued request.');
  turns[2].complete();
  await waitForSnapshot(request, (snapshot) =>
    snapshot.runs.every((run) => run.status === 'completed'),
  );
});
