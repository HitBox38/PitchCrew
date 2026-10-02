import { adapters } from '@pitchcrew/adapters';
import type { Approval, Card, ChatContext, ChatStreamState, Run, Snapshot } from '@pitchcrew/core';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readChatStream } from '../../ui/src/chat-stream.ts';
import { cleanup, finish, setup, waitForSnapshot } from './helpers/daemon.ts';

afterEach(cleanup);
describe('agent conversations and crew actions', () => {
  it('streams user and agent follow-up replies, restores previews on reconnect and saves only final text', async () => {
    const turns: { context: ChatContext; complete: (reply: string) => void }[] = [];
    vi.spyOn(adapters.demo, 'chat').mockImplementation(
      (context) =>
        new Promise((resolve) => {
          turns.push({ context, complete: (reply) => resolve({ reply }) });
        }),
    );
    const { daemon, request, cookie } = await setup(14446);
    const states: ChatStreamState[] = [];
    const streams: { controller: AbortController; done: Promise<void> }[] = [];
    const connect = async () => {
      const controller = new AbortController();
      const response = await fetch(`${daemon.url}/api/chat/stream`, {
        signal: controller.signal,
        headers: { cookie, 'x-pitchcrew-client': 'ui' },
      });
      expect(response.headers.get('content-type')).toContain('text/event-stream');
      const done = readChatStream(response.body!, (state) => states.push(state)).catch((error) => {
        if (!controller.signal.aborted) throw error;
      });
      streams.push({ controller, done });
      return controller;
    };
    try {
      const firstConnection = await connect();
      await vi.waitFor(() => expect(states).toHaveLength(1));
      expect(states[0]).toEqual({ messages: [], streamingMessages: [] });
      const { result: root } = await request<Run>('/roles/scout/chat', 'POST', {
        content: 'Help me.',
      });
      await vi.waitFor(() => expect(turns).toHaveLength(1));
      turns[0].context.onReply!('A partial reply');
      await vi.waitFor(() =>
        expect(states.at(-1)?.streamingMessages[0]?.content).toBe('A partial reply'),
      );
      const preview = states.at(-1)!.streamingMessages[0];
      expect(preview).toMatchObject({
        from: 'scout',
        to: 'user',
        threadId: 'scout',
        runId: root.id,
      });
      expect(daemon.service.board.list('message')).toHaveLength(1);
      const token = [...daemon.service.capabilities.keys()][0];
      expect(JSON.stringify(await daemon.service.agentCall(token, 'messages', {}))).not.toContain(
        'A partial reply',
      );
      expect((await request<Snapshot>('/snapshot')).result.streamingMessages).toEqual([preview]);
      firstConnection.abort();
      await connect();
      await vi.waitFor(() => expect(states.at(-1)?.streamingMessages[0]?.id).toBe(preview.id));
      await daemon.service.agentCall(token, 'message', {
        roleId: 'writer',
        content: 'Help Scout with a reply.',
      });
      turns[0].complete('The validated final reply');
      await vi.waitFor(() => expect(turns).toHaveLength(2));
      turns[1].context.onReply!('Writer is responding');
      await vi.waitFor(() => expect(states.at(-1)?.streamingMessages[0]?.from).toBe('writer'));
      const crewPreview = states.at(-1)!.streamingMessages[0];
      expect(crewPreview).toMatchObject({
        from: 'writer',
        to: 'scout',
        threadId: 'crew',
        content: 'Writer is responding',
      });
      expect(states.at(-1)!.messages.find((message) => message.id === preview.id)?.content).toBe(
        'The validated final reply',
      );
      expect(states.at(-1)!.messages.some((message) => message.content === 'A partial reply')).toBe(
        false,
      );
      turns[1].complete('Writer’s final response');
      await vi.waitFor(() => {
        expect(states.at(-1)?.streamingMessages).toEqual([]);
        expect(
          states.at(-1)?.messages.find((message) => message.id === crewPreview.id)?.content,
        ).toBe('Writer’s final response');
      });
      await waitForSnapshot(request, (snapshot) =>
        snapshot.runs.every((run) => run.status === 'completed'),
      );
      turns[1].context.onReply!('Late text after completion');
      expect(daemon.service.chatState().streamingMessages).toEqual([]);
      daemon.service.board.rebuild();
      const snapshot = (await request<Snapshot>('/snapshot')).result;
      expect(snapshot.streamingMessages).toEqual([]);
      expect(
        snapshot.messages.filter(
          (message) => message.id === preview.id || message.id === crewPreview.id,
        ),
      ).toHaveLength(2);
      expect(
        snapshot.events.some(
          (event) =>
            event.kind === 'message' &&
            ['A partial reply', 'Writer is responding'].includes(
              (event.data as { content: string }).content,
            ),
        ),
      ).toBe(false);
    } finally {
      for (const turn of turns) turn.complete('Cleanup');
      for (const { controller } of streams) controller.abort();
      await Promise.all(streams.map(({ done }) => done));
    }
  });

  it.each(['cancelled', 'failed'] as const)(
    'clears unfinished %s replies and ignores late text',
    async (status) => {
      let context!: ChatContext;
      let complete!: () => void;
      vi.spyOn(adapters.demo, 'chat').mockImplementation(async (input) => {
        context = input;
        input.onReply!('Unfinished reply');
        await new Promise<void>((resolve) => {
          complete = resolve;
        });
        input.onReply!('Late text');
        return { reply: status === 'failed' ? '' : 'Late final text' };
      });
      const { daemon, request } = await setup(status === 'cancelled' ? 14447 : 14448);
      const { result: run } = await request<Run>('/roles/scout/chat', 'POST', {
        content: 'Start a turn.',
      });
      await vi.waitFor(() => expect(complete).toBeDefined());
      expect(daemon.service.chatState().streamingMessages[0]?.content).toBe('Unfinished reply');
      if (status === 'cancelled') {
        await request(`/runs/${run.id}/cancel`, 'POST');
        expect(daemon.service.chatState().streamingMessages).toEqual([]);
        context.onReply!('Late text after cancellation');
        expect(daemon.service.chatState().streamingMessages).toEqual([]);
      }
      complete();
      const snapshot = await waitForSnapshot(request, (state) => state.runs[0].status === status);
      expect(snapshot.streamingMessages).toEqual([]);
      expect(snapshot.messages.map((message) => message.from)).toEqual(['user', 'system']);
    },
  );

  it('protects the live stream with the same session, client and origin checks as snapshots', async () => {
    const { daemon, cookie } = await setup(14449);
    const deniedHeaders: Record<string, string>[] = [
      { 'x-pitchcrew-client': 'ui' },
      { cookie },
      { cookie, 'x-pitchcrew-client': 'ui', origin: 'https://example.invalid' },
      { cookie, 'x-pitchcrew-client': 'ui', 'sec-fetch-site': 'cross-site' },
    ];
    for (const headers of deniedHeaders) {
      const response = await fetch(`${daemon.url}/api/chat/stream`, { headers });
      expect(response.status).toBe(403);
      await response.body?.cancel();
    }
  });

  it('persists role chats without a job/profile, isolates conversations, and rejects overlapping sends', async () => {
    const { daemon, request } = await setup(14422);
    const results = await Promise.all([
      request<Run>('/roles/scout/chat', 'POST', { content: 'Help me understand your role.' }),
      request<Run>('/roles/scout/chat', 'POST', { content: 'A competing message.' }),
    ]);
    expect(results.map((r) => r.response.status).sort()).toEqual([202, 400]);
    const run = results.find((r) => r.response.status === 202)!.result;
    expect(run).toMatchObject({ mode: 'chat', cardId: null, roleId: 'scout' });
    const token = [...daemon.service.capabilities.keys()][0];
    expect(
      (await request('/agent', 'POST', { action: 'card' }, { authorization: `Bearer ${token}` }))
        .response.status,
    ).toBe(400);
    expect(
      (await request('/roles/writer/chat', 'POST', { content: 'Private writer context.' })).response
        .status,
    ).toBe(202);
    const context = await daemon.service.agentCall(token, 'messages', {});
    expect(context.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ content: 'Help me understand your role.' }),
      ]),
    );
    expect(context.messages).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ content: 'Private writer context.' })]),
    );
    const snapshot = await finish(request, run.id);
    expect(snapshot.messages.filter((m) => m.threadId === 'scout')).toHaveLength(2);
    expect(snapshot.messages.find((m) => m.from === 'scout')?.content).toContain('demo reply');
    await waitForSnapshot(request, (s) => s.runs.every((r) => r.status !== 'running'));
    daemon.service.board.rebuild();
    expect((await request<Snapshot>('/snapshot')).result.messages).toHaveLength(4);
    await expect(daemon.service.agentCall(token, 'messages', {})).rejects.toThrow('expired');
    expect(
      (await request('/roles/scout/chat', 'POST', { content: 'bad thread', threadId: 'writer' }))
        .response.status,
    ).toBe(400);
  });

  it('uses scoped tools for visible messages, self-invocation, workflow handoffs and approved role changes', async () => {
    const { daemon, request, directory } = await setup(14423);
    await request('/profile', 'PUT', {
      name: 'profile.md',
      content: '# Example Candidate\n\n- Built React interfaces.',
    });
    const { result: card } = await request<Card>('/cards', 'POST', {
      company: 'Fixture Co',
      title: 'React Engineer',
    });
    const { result: other } = await request<Card>('/cards', 'POST', {
      company: 'Other Fixture',
      title: 'Engineer',
    });
    const { result: run } = await request<Run>('/roles/scout/chat', 'POST', {
      content: 'Shortlist this job and coordinate a draft and review.',
      cardId: card.id,
    });
    const token = [...daemon.service.capabilities.keys()][0];
    const agent = <T>(body: unknown) =>
      request<T>('/agent', 'POST', body, { authorization: `Bearer ${token}` });
    expect(
      (
        await agent({
          action: 'workflow',
          state: 'shortlisted',
          reason: 'A strong match for this profile.',
          cardId: other.id,
        })
      ).response.status,
    ).toBe(200);
    expect(daemon.service.board.get<Card>('card', other.id).state).toBe('lead');
    expect(daemon.service.board.get<Card>('card', card.id).state).toBe('shortlisted');
    const proposalResult = await agent<{ proposal: import('@pitchcrew/core').RoleProposal }>({
      action: 'propose',
      reason: 'Focus future evaluations on accessibility.',
      changes: {
        instructions: 'Evaluate accessibility roles first.',
        capabilities: { messageAgents: true, invokeAgents: false, manageWorkflow: false },
      },
    });
    expect(proposalResult.response.status).toBe(200);
    const proposal = proposalResult.result.proposal;
    expect(
      daemon.service.board.get<import('@pitchcrew/core').Role>('role', 'scout').instructions,
    ).not.toBe(proposal.changes.instructions);
    expect(
      (await request(`/proposals/${proposal.id}/decide`, 'POST', { approved: true })).response
        .status,
    ).toBe(400);
    expect(
      (
        await agent({
          action: 'invoke',
          roleId: 'writer',
          mode: 'workflow',
          content: 'Draft a source-backed packet.',
        })
      ).response.status,
    ).toBe(200);
    expect(
      (
        await agent({
          action: 'invoke',
          roleId: 'reviewer',
          mode: 'workflow',
          content: 'Review the writer’s packet.',
        })
      ).response.status,
    ).toBe(200);
    expect(
      (
        await agent({
          action: 'message',
          roleId: 'reviewer',
          content: 'Tell me how you check evidence.',
        })
      ).response.status,
    ).toBe(200);
    expect(
      (
        await agent({
          action: 'invoke',
          roleId: 'scout',
          mode: 'chat',
          content: 'Summarize your plan.',
        })
      ).response.status,
    ).toBe(200);
    const snapshot = await waitForSnapshot(
      request,
      (s) => s.tasks.length === 4 && s.tasks.every((t) => t.status === 'completed'),
    );
    expect(snapshot.cards.find((c) => c.id === card.id)?.state).toBe('agreed');
    expect(snapshot.tasks.every((t) => t.rootRunId === run.id && t.cardId === card.id)).toBe(true);
    expect(snapshot.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          threadId: 'crew',
          from: 'scout',
          to: 'reviewer',
          content: 'Tell me how you check evidence.',
        }),
        expect.objectContaining({ threadId: 'crew', from: 'reviewer', to: 'scout' }),
        expect.objectContaining({ threadId: 'crew', from: 'scout', to: 'scout' }),
      ]),
    );
    const decisions = await Promise.all([
      request(`/proposals/${proposal.id}/decide`, 'POST', { approved: true }),
      request(`/proposals/${proposal.id}/decide`, 'POST', { approved: true }),
    ]);
    expect(decisions.map((r) => r.response.status).sort()).toEqual([200, 400]);
    expect(await readFile(join(directory, 'roles/scout/AGENTS.md'), 'utf8')).toContain(
      'Evaluate accessibility roles first.',
    );
    const { result: next } = await request<Run>('/roles/scout/chat', 'POST', {
      content: 'Try a disabled capability.',
      cardId: card.id,
    });
    const nextToken = [...daemon.service.capabilities.entries()].find(
      ([, c]) => c.runId === next.id,
    )![0];
    await expect(
      daemon.service.agentCall(nextToken, 'invoke', {
        roleId: 'writer',
        content: 'Try',
        mode: 'workflow',
      }),
    ).rejects.toThrow('disabled');
    const approval = daemon.service.board.requestApproval(card.id);
    daemon.service.board.decideApproval(approval.id, true);
    await expect(
      daemon.service.agentCall(nextToken, 'workflow', {
        state: 'changes_requested',
        reason: 'Revise it.',
      }),
    ).rejects.toThrow('disabled');
    await finish(request, next.id);
    const { result: reviewerChat } = await request<Run>('/roles/reviewer/chat', 'POST', {
      content: 'Request revision.',
      cardId: card.id,
    });
    const reviewerToken = [...daemon.service.capabilities.entries()].find(
      ([, c]) => c.runId === reviewerChat.id,
    )![0];
    await daemon.service.agentCall(reviewerToken, 'workflow', {
      state: 'changes_requested',
      reason: 'Personalize the letter.',
    });
    expect(daemon.service.board.get<Approval>('approval', approval.id).status).toBe('rejected');
    await expect(daemon.service.exportPacket(approval.id)).rejects.toThrow('unused approval');
  });

  it('bounds recursive follow-ups and cancels the chain without launching queued work', async () => {
    const { daemon, request } = await setup(14424);
    const { result: run } = await request<Run>('/roles/scout/chat', 'POST', {
      content: 'Plan a discussion.',
    });
    const token = [...daemon.service.capabilities.keys()][0];
    for (let i = 0; i < 6; i++)
      await daemon.service.agentCall(token, 'invoke', {
        roleId: 'scout',
        content: `Follow-up ${i}`,
        mode: 'chat',
      });
    await expect(
      daemon.service.agentCall(token, 'message', {
        roleId: 'writer',
        content: 'Seventh follow-up',
      }),
    ).rejects.toThrow('six follow-up limit');
    await request(`/runs/${run.id}/cancel`, 'POST');
    await expect(daemon.service.agentCall(token, 'messages', {})).rejects.toThrow('expired');
    const snapshot = await waitForSnapshot(request, (s) =>
      s.runs.every((r) => r.status !== 'running'),
    );
    expect(snapshot.runs).toHaveLength(1);
    expect(snapshot.runs[0].status).toBe('cancelled');
    expect(snapshot.tasks.every((t) => t.status === 'cancelled')).toBe(true);
    expect(snapshot.messages.some((m) => m.from === 'scout' && m.to === 'user')).toBe(false);
  });

  it('recovers interrupted chats and queued invocations on startup', async () => {
    const { daemon } = await setup(14425);
    daemon.service.board.record(
      'run',
      {
        id: 'interrupted-chat',
        cardId: null,
        roleId: 'scout',
        runtime: 'demo',
        mode: 'chat',
        status: 'running',
        message: '',
        startedAt: '',
        finishedAt: null,
      },
      'scout',
      'Fixture interrupted chat',
    );
    daemon.service.board.record(
      'task',
      {
        id: 'interrupted-task',
        parentRunId: 'interrupted-chat',
        rootRunId: 'interrupted-chat',
        roleId: 'writer',
        cardId: null,
        mode: 'chat',
        trigger: 'message',
        threadId: 'crew',
        content: 'Retry safely',
        status: 'queued',
        runId: null,
        error: '',
        createdAt: '',
      },
      'scout',
      'Fixture interrupted task',
    );
    await daemon.service.initialize(false);
    const snapshot = await daemon.service.snapshot();
    expect(snapshot.runs[0].status).toBe('failed');
    expect(snapshot.tasks[0].status).toBe('failed');
    expect(daemon.service.controllers.size).toBe(0);
  });
});
it('bounds an actual recursive self-invocation chain across descendant chat turns', async () => {
  const { request } = await setup(14426);
  vi.spyOn(adapters.demo, 'chat').mockImplementation(async (context) => {
    const response = await fetch(`${context.mcp.env.PITCHCREW_DAEMON_URL}/api/agent`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${context.mcp.env.PITCHCREW_RUN_TOKEN}`,
      },
      body: JSON.stringify({
        action: 'invoke',
        roleId: context.role.id,
        mode: 'chat',
        content: 'Continue the fixture discussion.',
      }),
    });
    const result = (await response.json()) as { error?: string };
    return { reply: response.ok ? 'Queued the next fixture turn.' : result.error! };
  });
  const { result: root } = await request<Run>('/roles/scout/chat', 'POST', {
    content: 'Start a recursive fixture.',
  });
  const snapshot = await waitForSnapshot(
    request,
    (s) =>
      s.runs.length === 7 &&
      s.runs.every((r) => r.status === 'completed') &&
      s.tasks.every((t) => t.status === 'completed'),
  );
  expect(snapshot.tasks).toHaveLength(6);
  expect(snapshot.tasks.every((t) => t.rootRunId === root.id)).toBe(true);
  expect(snapshot.messages.at(-1)?.content).toContain('six follow-up limit');
});
