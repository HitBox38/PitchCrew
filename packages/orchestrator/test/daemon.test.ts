import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adapters } from '@pitchcrew/adapters';
import { createDaemon } from '../src/server.ts';
import type {
  Approval,
  Card,
  Role,
  Run,
  Snapshot,
  RuntimeModelCatalog,
  RuntimeModel,
  ChatContext,
  ChatStreamState,
} from '@pitchcrew/core';
import { readChatStream } from '../../ui/src/chat-stream.ts';
const resources: { daemon: Awaited<ReturnType<typeof createDaemon>>; directory: string }[] = [];
async function setup(port: number) {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-test-'));
  const daemon = await createDaemon({ directory, port });
  resources.push({ daemon, directory });
  await new Promise<void>((resolve) => daemon.http.listen(port, '127.0.0.1', resolve));
  const response = await fetch(daemon.url);
  const cookie = response.headers.get('set-cookie')!.split(';')[0];
  async function request<T>(
    path: string,
    method = 'GET',
    body?: unknown,
    extra: Record<string, string> = {},
  ) {
    const response = await fetch(`${daemon.url}/api${path}`, {
      method,
      headers: { cookie, 'x-pitchcrew-client': 'ui', 'content-type': 'application/json', ...extra },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const result = (await response.json()) as T;
    return { response, result };
  }
  return { daemon, directory, request, cookie };
}
afterEach(async () => {
  vi.restoreAllMocks();
  for (const { daemon, directory } of resources.splice(0)) {
    await daemon.close();
    const prefix = resolve(tmpdir(), 'pitchcrew-test-');
    if (!resolve(directory).startsWith(prefix)) throw new Error('Refusing unsafe cleanup target.');
    await rm(directory, { recursive: true, force: true });
  }
});
async function finish(request: <T>(path: string) => Promise<{ result: T }>, id: string) {
  for (let i = 0; i < 80; i++) {
    const { result } = await request<Snapshot>('/snapshot');
    const run = result.runs.find((run) => run.id === id);
    if (run && run.status !== 'running') {
      expect(run.status, run.message).toBe('completed');
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error('Run did not finish.');
}
describe('local daemon workflow', () => {
  it('discovers models on demand, caches and refreshes them without provider calls or board events', async () => {
    vi.spyOn(adapters.opencode, 'detect').mockResolvedValue({
      id: 'opencode',
      available: true,
      version: 'fixture',
      detail: 'Fixture runtime',
    });
    const list = vi
      .spyOn(adapters.opencode, 'listModels')
      .mockResolvedValue([{ value: 'fixture/live-one', label: 'Live One' }]);
    const { daemon, request } = await setup(14434);
    expect(list).not.toHaveBeenCalled();
    const eventsBefore = daemon.service.board.events();
    const { result: initial } = await request<RuntimeModelCatalog>(
      '/runtimes/opencode/models',
      'POST',
      {},
    );
    expect(initial).toMatchObject({
      modelSource: 'runtime',
      models: [{ value: 'fixture/live-one', label: 'Live One' }],
    });
    expect(
      (await request<Snapshot>('/snapshot')).result.runtimes.find(
        (runtime) => runtime.id === 'opencode',
      ),
    ).toMatchObject(initial);
    expect(
      (await request<RuntimeModelCatalog>('/runtimes/opencode/models', 'POST', {})).result,
    ).toEqual(initial);
    expect(list).toHaveBeenCalledOnce();
    list.mockResolvedValueOnce([{ value: 'fixture/live-two', label: 'Live Two' }]);
    expect(
      (await request<RuntimeModelCatalog>('/runtimes/opencode/models', 'POST', { refresh: true }))
        .result.models,
    ).toEqual([{ value: 'fixture/live-two', label: 'Live Two' }]);
    expect(list).toHaveBeenCalledTimes(2);
    list.mockRejectedValueOnce(new Error('fixture-private-diagnostic'));
    const { result: fallback } = await request<RuntimeModelCatalog>(
      '/runtimes/opencode/models',
      'POST',
      { refresh: true },
    );
    expect(fallback).toMatchObject({ modelSource: 'fallback', models: adapters.opencode.models });
    expect(JSON.stringify(fallback)).not.toContain('fixture-private-diagnostic');
    expect(
      (await request<RuntimeModelCatalog>('/runtimes/claude-code/models', 'POST', {})).result
        .modelSource,
    ).toBe('fallback');
    expect(
      (await request<RuntimeModelCatalog>('/runtimes/demo/models', 'POST', {})).result,
    ).toMatchObject({ modelSource: 'none', models: [] });
    expect((await request('/runtimes/invalid/models', 'POST', {})).response.status).toBe(400);
    expect(
      (
        await request(
          '/runtimes/opencode/models',
          'POST',
          {},
          { origin: 'https://example.invalid' },
        )
      ).response.status,
    ).toBe(403);
    expect(daemon.service.board.events()).toEqual(eventsBefore);
  });

  it('deduplicates concurrent model discovery and reloads expired catalogs', async () => {
    vi.spyOn(adapters.opencode, 'detect').mockResolvedValue({
      id: 'opencode',
      available: true,
      version: 'fixture',
      detail: 'Fixture runtime',
    });
    let resolveModels!: (models: RuntimeModel[]) => void;
    const list = vi.spyOn(adapters.opencode, 'listModels').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveModels = resolve;
        }),
    );
    const { request } = await setup(14435);
    const first = request<RuntimeModelCatalog>('/runtimes/opencode/models', 'POST', {});
    const second = request<RuntimeModelCatalog>('/runtimes/opencode/models', 'POST', {});
    await vi.waitFor(() => expect(list).toHaveBeenCalledOnce());
    resolveModels([{ value: 'fixture/live', label: 'Live' }]);
    expect((await first).result).toEqual((await second).result);
    expect(list).toHaveBeenCalledOnce();
    list.mockResolvedValueOnce([]);
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 5 * 60 * 1000 + 1);
    const { result: expired } = await request<RuntimeModelCatalog>(
      '/runtimes/opencode/models',
      'POST',
      {},
    );
    expect(expired).toMatchObject({ modelSource: 'runtime', models: [] });
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('exposes the new runtimes and persists their role settings through event replay', async () => {
    const { daemon, request } = await setup(14420);
    const { result: snapshot } = await request<Snapshot>('/snapshot');
    expect(snapshot.runtimes.map((runtime) => runtime.id)).toEqual([
      'demo',
      'claude-code',
      'codex',
      'gemini-cli',
      'opencode',
      'copilot-cli',
      'cursor-agent',
      'goose',
      'kiro-cli',
      'grok',
      'pi',
      'oh-my-pi',
    ]);
    for (const runtime of snapshot.runtimes) {
      if (runtime.id === 'demo') {
        expect(runtime.models).toEqual([]);
        continue;
      }
      // Every runtime's public catalog must survive adapter normalization and detection.
      expect(runtime.models.length, runtime.id).toBeGreaterThan(0);
      const values = runtime.models.map((model) => model.value);
      expect(new Set(values).size, runtime.id).toBe(values.length);
      for (const model of runtime.models) {
        expect(model.value.trim(), runtime.id).not.toBe('');
        expect(model.label.trim(), runtime.id).not.toBe('');
        expect(model.value.length, runtime.id).toBeLessThanOrEqual(100);
      }
    }
    // Choices from every catalog round-trip unchanged, including provider/model selectors.
    for (const runtime of snapshot.runtimes.filter((runtime) => runtime.id !== 'demo')) {
      const model = runtime.models[0].value;
      const settings = {
        runtime: runtime.id,
        model,
        enabled: true,
        instructions: 'Fictional role settings.',
      };
      const saved = await request<Role>('/roles/scout', 'PUT', settings);
      expect(saved.response.status, runtime.id).toBe(200);
      expect(saved.result).toMatchObject(settings);
      daemon.service.board.rebuild();
      expect(daemon.service.board.get<Role>('role', 'scout')).toMatchObject(settings);
    }
    for (const [id, runtime, model] of [
      ['scout', 'gemini-cli', 'fixture-model'],
      ['writer', 'opencode', 'example/fixture-model'],
      ['reviewer', 'copilot-cli', 'fixture-model'],
      ['scout', 'cursor-agent', 'fixture-model'],
      ['writer', 'goose', 'openai/fixture-model'],
      ['reviewer', 'kiro-cli', 'fixture-model'],
      ['scout', 'grok', 'fixture-model'],
      ['writer', 'pi', 'example/fixture-model'],
      ['reviewer', 'oh-my-pi', 'example/fixture-model'],
    ] as const) {
      const settings = { runtime, model, enabled: true, instructions: 'Fictional role settings.' };
      const saved = await request<Role>(`/roles/${id}`, 'PUT', settings);
      expect(saved.response.status).toBe(200);
      expect(saved.result).toMatchObject(settings);
      daemon.service.board.rebuild();
      expect(daemon.service.board.get<Role>('role', id)).toMatchObject(settings);
    }
  });
  it('runs a source-backed application through review, approval, export and manual tracking', async () => {
    const { request, directory } = await setup(14417);
    await request('/profile', 'PUT', {
      name: 'profile.md',
      content: '# Example Candidate\n\n- Built React interfaces.\n',
    });
    const { result: card } = await request<Card>('/cards', 'POST', {
      company: 'Fixture Co',
      title: 'React Engineer',
      description: 'Build React interfaces.',
    });
    const { result: scout } = await request<Run>(`/cards/${card.id}/run`, 'POST', {
      roleId: 'scout',
    });
    await finish(request, scout.id);
    await request(`/cards/${card.id}/move`, 'POST', { state: 'shortlisted' });
    const candidates = await Promise.all([
      request<Run>(`/cards/${card.id}/run`, 'POST', { roleId: 'writer' }),
      request<Run>(`/cards/${card.id}/run`, 'POST', { roleId: 'writer' }),
    ]);
    expect(candidates.map((x) => x.response.status).sort()).toEqual([202, 400]);
    const writer = candidates.find((x) => x.response.status === 202)!.result;
    await finish(request, writer.id);
    const { result: reviewer } = await request<Run>(`/cards/${card.id}/run`, 'POST', {
      roleId: 'reviewer',
    });
    const reviewed = await finish(request, reviewer.id);
    expect(reviewed.cards.find((c) => c.id === card.id)?.state).toBe('agreed');
    const { result: approval } = await request<Approval>(`/cards/${card.id}/approval`, 'POST');
    expect((await request(`/approvals/${approval.id}/export`, 'POST')).response.status).toBe(400);
    expect(
      (await request(`/cards/${card.id}/move`, 'POST', { state: 'submitted' })).response.status,
    ).toBe(400);
    await request(`/approvals/${approval.id}/decide`, 'POST', { approved: true });
    const exported = await request<{ directory: string }>(
      `/approvals/${approval.id}/export`,
      'POST',
    );
    expect(exported.response.status).toBe(200);
    expect(exported.result.directory.startsWith(directory)).toBe(true);
    expect(await readFile(join(exported.result.directory, 'resume.md'), 'utf8')).toContain(
      'Built React interfaces.',
    );
    expect((await request(`/approvals/${approval.id}/export`, 'POST')).response.status).toBe(400);
    await request(`/cards/${card.id}/move`, 'POST', { state: 'changes_requested' });
    await request('/profile', 'PUT', {
      name: 'profile.md',
      content:
        '# Example Candidate\n\n- Built React interfaces.\n- Shipped accessible scheduling tools.\n',
    });
    const { result: revised } = await request<Run>(`/cards/${card.id}/run`, 'POST', {
      roleId: 'writer',
    });
    await finish(request, revised.id);
    const { result: reviewedAgain } = await request<Run>(`/cards/${card.id}/run`, 'POST', {
      roleId: 'reviewer',
    });
    await finish(request, reviewedAgain.id);
    const { result: freshApproval } = await request<Approval>(`/cards/${card.id}/approval`, 'POST');
    expect(
      (await request(`/cards/${card.id}/move`, 'POST', { state: 'submitted' })).response.status,
    ).toBe(400);
    await request(`/approvals/${freshApproval.id}/decide`, 'POST', { approved: true });
    expect((await request(`/approvals/${freshApproval.id}/export`, 'POST')).response.status).toBe(
      200,
    );
    await request(`/cards/${card.id}/move`, 'POST', { state: 'submitted' });
    await request(`/cards/${card.id}/move`, 'POST', { state: 'interviewing' });
    const { result: final } = await request<Snapshot>('/snapshot');
    expect(final.cards[0].state).toBe('interviewing');
  });
  it('rejects cross-origin/user-session bypasses and expired agent capabilities', async () => {
    const { daemon, request } = await setup(14418);
    expect((await fetch(`${daemon.url}/api/snapshot`)).status).toBe(403);
    expect(
      (
        await request(
          '/cards',
          'POST',
          { company: 'bad', title: 'bad' },
          { origin: 'https://evil.example' },
        )
      ).response.status,
    ).toBe(403);
    expect(
      (await request('/agent', 'POST', { action: 'profile' }, { authorization: 'Bearer missing' }))
        .response.status,
    ).toBe(403);
  });
  it('keeps role permissions and cancellation scoped to an active run', async () => {
    const { daemon, request } = await setup(14419);
    await request('/profile', 'PUT', {
      name: 'profile.md',
      content: '# Candidate\n\n- Built React interfaces.',
    });
    const { result: card } = await request<Card>('/cards', 'POST', {
      company: 'Fixture',
      title: 'Engineer',
    });
    const { result: run } = await request<Run>(`/cards/${card.id}/run`, 'POST', {
      roleId: 'scout',
    });
    const token = [...daemon.service.capabilities.keys()][0];
    expect((await daemon.service.agentCall(token, 'card', {})).card).toEqual(
      daemon.service.board.get('card', card.id),
    );
    await expect(daemon.service.agentCall(token, 'approve', {})).rejects.toThrow('not allowed');
    await request(`/runs/${run.id}/cancel`, 'POST');
    for (let i = 0; i < 50 && daemon.service.controllers.size; i++)
      await new Promise((resolve) => setTimeout(resolve, 20));
    await expect(daemon.service.agentCall(token, 'profile', {})).rejects.toThrow('expired');
    expect(daemon.service.board.get<Run>('run', run.id).status).toBe('cancelled');
  });
});

async function waitForSnapshot(
  request: <T>(path: string) => Promise<{ result: T }>,
  predicate: (snapshot: Snapshot) => boolean,
) {
  for (let i = 0; i < 150; i++) {
    const { result } = await request<Snapshot>('/snapshot');
    if (predicate(result)) return result;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error('Crew did not reach the expected state.');
}

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
    await daemon.service.initialize();
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

describe('connector account settings', () => {
  it('requires a local user session for account changes and never gives agents a connection action', async () => {
    const { daemon, request } = await setup(14433);
    const connect = vi.spyOn(daemon.service.connectors, 'connectGithub').mockResolvedValue([]);
    const disconnect = vi.spyOn(daemon.service.connectors, 'disconnect').mockResolvedValue([]);
    for (const path of [
      '/connectors/github/connect',
      '/connectors/google/connect',
      '/connectors/github/disconnect',
    ]) {
      expect(
        (
          await fetch(`${daemon.url}/api${path}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{}',
          })
        ).status,
      ).toBe(403);
      expect(
        (await request(path, 'POST', {}, { origin: 'https://evil.example' })).response.status,
      ).toBe(403);
    }
    expect(connect).not.toHaveBeenCalled();
    expect(
      (await request('/connectors/github/connect', 'POST', { token: 'fixture-token' })).response
        .status,
    ).toBe(200);
    expect(connect).toHaveBeenCalledWith({ token: 'fixture-token' });
    expect((await request('/connectors/github/disconnect', 'POST', {})).response.status).toBe(200);
    expect(disconnect).toHaveBeenCalledWith('github');
    expect((await request('/connectors/arbitrary/disconnect', 'POST', {})).response.status).toBe(
      400,
    );
    const snapshot = (await request<Snapshot>('/snapshot')).result;
    expect(snapshot.connectors).toHaveLength(2);
    expect(JSON.stringify(snapshot)).not.toContain('fixture-token');
    expect(snapshot.roles.every((r) => !r.capabilities?.github && !r.capabilities?.gmail)).toBe(
      true,
    );
  });
});
