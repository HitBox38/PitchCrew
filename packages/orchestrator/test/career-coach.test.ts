import { adapters } from '@pitchcrew/adapters';
import type {
  AgentMemory,
  Card,
  ChatContext,
  ChatResult,
  Run,
  UserInputRequest,
} from '@pitchcrew/core';
import { baseSkills } from '@pitchcrew/core/base-skills';
import { afterEach, expect, it, vi } from 'vitest';
import { skillDirectory } from '../src/skills-directory.ts';
import { cleanup, setup, waitForSnapshot } from './helpers/daemon.ts';

afterEach(cleanup);

it('uses offline coaching skills, scoped evidence and memory across a durable practice question', async () => {
  vi.spyOn(skillDirectory, 'preview').mockRejectedValue(new Error('Offline fixture'));
  const turns: { context: ChatContext; complete: () => void }[] = [];
  vi.spyOn(adapters.demo, 'chat').mockImplementation(
    (context) =>
      new Promise<ChatResult>((resolve, reject) => {
        context.signal.addEventListener('abort', () => reject(new Error('Stopped')), {
          once: true,
        });
        turns.push({ context, complete: () => resolve({ reply: 'Fictional coaching feedback.' }) });
      }),
  );
  const { daemon, request } = await setup(19748, true);
  const card = (
    await request<Card>('/cards', 'POST', { company: 'Example Works', title: 'Analyst' })
  ).result;
  const { result: run } = await request<Run>('/roles/career-coach/chat', 'POST', {
    content: 'Practice a behavioral interview with me.',
    attachments: [
      {
        name: 'practice.md',
        data: Buffer.from('I helped document the handoff.').toString('base64'),
      },
    ],
  });
  await vi.waitFor(() => expect(turns).toHaveLength(1));
  const { context } = turns[0];
  expect(context.card).toBeNull();
  expect(context.skills?.map((skill) => skill.name).sort()).toEqual(
    baseSkills
      .filter(
        (skill) => skill.defaultScope === 'all' || skill.defaultRoles.includes('career-coach'),
      )
      .map((skill) => skill.name)
      .sort(),
  );
  expect(context.skills?.every((skill) => !skill.source)).toBe(true);
  const token = context.mcp.env.PITCHCREW_RUN_TOKEN;
  const attachment = context.attachments![0];
  expect(
    await daemon.service.agentCall(token, 'chat_attachment', {
      messageId: attachment.messageId,
      attachmentId: attachment.id,
    }),
  ).toMatchObject({ text: 'I helped document the handoff.', truncated: false });
  expect(
    await daemon.service.agentCall(token, 'applications', { input: { company: card.company } }),
  ).toMatchObject({ cards: [expect.objectContaining({ id: card.id })] });
  expect(await daemon.service.agentCall(token, 'application_insights', {})).toHaveProperty(
    'outcomes',
  );
  expect(await daemon.service.agentCall(token, 'computer_access', {})).toEqual({
    enabled: true,
    assessForms: false,
    recordSubmissions: false,
  });
  await expect(
    daemon.service.agentCall(token, 'invoke', {
      roleId: 'scout',
      content: 'Evaluate the job.',
    }),
  ).rejects.toThrow();
  await expect(
    daemon.service.agentCall(token, 'workflow', {
      cardId: card.id,
      state: 'shortlisted',
      reason: 'Fixture mutation must be denied.',
    }),
  ).rejects.toThrow();
  await expect(
    daemon.service.agentCall(token, 'tracking_scan', {
      input: { query: 'interview' },
    }),
  ).rejects.toThrow();
  const { memory } = (await daemon.service.agentCall(token, 'save_memory', {
    content:
      'Practice target: behavioral questions. User reports helping document a handoff; not verified Profile evidence.',
    tags: ['interview-practice'],
  })) as { memory: AgentMemory };
  expect(memory.source).toMatchObject({ threadId: 'career-coach', messageId: expect.any(String) });
  const { question } = (await daemon.service.agentCall(token, 'ask_user', {
    question: 'Tell me about a difficult handoff.',
    continuationNotes: 'Coached practice: await the user answer before feedback.',
  })) as { question: UserInputRequest };
  await waitForSnapshot(
    request,
    (snapshot) => snapshot.runs.find((entry) => entry.id === run.id)?.status === 'waiting',
  );
  expect(
    (
      await request(`/user-input/${question.id}/answer`, 'POST', {
        text: 'I wrote a checklist and asked the receiving team to review it.',
      })
    ).response.status,
  ).toBe(202);
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  expect(turns[1].context.request).toContain('I wrote a checklist');
  const resumedToken = turns[1].context.mcp.env.PITCHCREW_RUN_TOKEN;
  expect(await daemon.service.agentCall(resumedToken, 'recall_memory', {})).toMatchObject({
    memories: [expect.objectContaining({ id: memory.id })],
  });
  turns[1].complete();
  await waitForSnapshot(request, (snapshot) =>
    snapshot.runs.every((entry) => entry.status === 'completed'),
  );
  daemon.service.board.rebuild();
  expect(daemon.service.board.list<AgentMemory>('agent_memory')).toContainEqual(memory);
  expect(daemon.service.board.get<Card>('card', card.id).state).toBe('lead');
  expect(daemon.service.board.list('approval')).toEqual([]);
});
