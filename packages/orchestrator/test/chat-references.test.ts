import { afterEach, expect, it, vi } from 'vitest';
import type {
  ChatContext,
  ChatMessage,
  ChatRequest,
  ChatResult,
  Conversation,
  Skill,
} from '@pitchcrew/core';
import { adapters } from '@pitchcrew/adapters';
import { instructionsFor } from '../../adapters/src/process/prompts.ts';
import { setup, cleanup, waitForSnapshot } from './helpers/daemon.ts';
afterEach(cleanup);

it('saves server-owned reference labels and digests, routes only real mentions and passes selected skills to the runtime', async () => {
  const { request, daemon } = await setup(19631);
  const contexts: ChatContext[] = [];
  vi.spyOn(adapters.demo, 'chat').mockImplementation(async (context) => {
    contexts.push(context);
    return { reply: 'Checked.' };
  });
  const skill = (
    await request<Skill>('/skills', 'POST', {
      name: 'Evidence check',
      content: 'Use exact quotations.',
      description: 'Check evidence.',
      scope: 'roles',
      roleIds: ['scout'],
    })
  ).result;
  const group = (
    await request<Conversation>('/conversations', 'POST', {
      title: 'Reference fixture',
      participants: ['scout', 'writer'],
    })
  ).result;
  const text =
    '@scout Use $evidence-check. Literal `@writer` and name@writer.com are not recipients.';
  const sent = await request<ChatRequest>(`/conversations/${group.id}/messages`, 'POST', {
    content: text,
  });
  expect(sent.response.status).toBe(202);
  expect(sent.result.deliveries.map((d) => d.roleId)).toEqual(['scout']);
  expect(sent.result.references).toMatchObject([
    { kind: 'agent', label: 'Scout' },
    {
      kind: 'skill',
      id: skill.id,
      label: 'Evidence check',
      digest: expect.stringMatching(/^[a-f0-9]{64}$/),
    },
  ]);
  await vi.waitFor(() => expect(contexts).toHaveLength(1));
  expect(contexts[0].selectedSkills?.map((s) => s.id)).toEqual([skill.id]);
  expect(instructionsFor(contexts[0])).toContain('Explicit user-selected skills');
  await waitForSnapshot(request, (s) => s.runs.every((run) => run.status === 'completed'));
  await request(`/skills/${skill.id}`, 'PUT', {
    name: 'Renamed evidence check',
    content: skill.content,
    description: skill.description,
    scope: skill.scope,
    roleIds: skill.roleIds,
  });
  daemon.service.board.rebuild();
  const saved = daemon.service.board.get<ChatMessage>('message', sent.result.messageId);
  expect(saved.references?.[1].label).toBe('Evidence check');
  expect(saved.content).toBe(text);
});
it('rejects forged, deleted and unassigned selections before queuing anything', async () => {
  const { request } = await setup(19632);
  const group = (
    await request<Conversation>('/conversations', 'POST', {
      title: 'Scope fixture',
      participants: ['scout'],
    })
  ).result;
  const skill = (
    await request<Skill>('/skills', 'POST', {
      name: 'Writer only',
      content: 'Writer instructions.',
      scope: 'roles',
      roleIds: ['writer'],
    })
  ).result;
  const post = (content: string, references?: unknown[]) =>
    request(`/conversations/${group.id}/messages`, 'POST', { content, references });
  expect((await post('$writer-only')).response.status).toBe(400);
  expect(
    (await post('@scout', [{ kind: 'agent', id: 'writer', token: '@scout', start: 0, end: 6 }]))
      .response.status,
  ).toBe(400);
  expect(
    (await post('$removed', [{ kind: 'skill', id: skill.id, token: '$removed', start: 0, end: 8 }]))
      .response.status,
  ).toBe(400);
  expect((await post('`@writer` Explain this example.')).response.status).toBe(202);
});
it('fails a queued selection after its instructions change, and resolves fresh references when edited', async () => {
  const { request } = await setup(19633);
  let complete!: (reply: ChatResult) => void;
  const turns: ChatContext[] = [];
  vi.spyOn(adapters.demo, 'chat').mockImplementation((context) => {
    turns.push(context);
    return turns.length === 1
      ? new Promise((resolve) => {
          complete = resolve;
        })
      : Promise.resolve({ reply: 'Done.' });
  });
  const skill = (
    await request<Skill>('/skills', 'POST', {
      name: 'Check',
      content: 'First version.',
      scope: 'all',
    })
  ).result;
  await request('/conversations/scout/messages', 'POST', { content: 'Hold the first turn.' });
  await vi.waitFor(() => expect(turns).toHaveLength(1));
  const queued = (
    await request<ChatRequest>('/conversations/scout/messages', 'POST', {
      content: '$check Check evidence.',
    })
  ).result;
  await request(`/skills/${skill.id}`, 'PUT', {
    name: skill.name,
    content: 'Changed version.',
    scope: skill.scope,
    roleIds: skill.roleIds,
  });
  complete({ reply: 'Finished.' });
  const failed = await waitForSnapshot(
    request,
    (s) =>
      s.chatRequests?.some((r) => r.id === queued.id && r.deliveries[0].status === 'failed') ??
      false,
  );
  expect(failed.chatRequests?.find((r) => r.id === queued.id)?.deliveries[0].error).toContain(
    'changed',
  );
  expect(turns).toHaveLength(1);
  expect(
    (
      await request(`/chat-requests/${queued.id}`, 'PUT', {
        action: 'edit',
        content: '$check Check updated evidence.',
      })
    ).response.status,
  ).toBe(200);
  await request(`/chat-requests/${queued.id}`, 'PUT', { action: 'resume' });
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  expect(turns[1].selectedSkills?.[0].content).toBe('Changed version.');
});
