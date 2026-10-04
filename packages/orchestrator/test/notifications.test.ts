import { adapters } from '@pitchcrew/adapters';
import type { ChatMessage, Run } from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, finish, setup } from './helpers/daemon.ts';

afterEach(cleanup);
it('persists bounded, scoped user requests, replays priority and expires run access', async () => {
  let complete!: (value: { reply: string }) => void;
  vi.spyOn(adapters.demo, 'chat').mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const { daemon, request } = await setup(14520);
  const { result: run } = await request<Run>('/roles/scout/chat', 'POST', {
    content: 'Research a fictional role.',
  });
  await vi.waitFor(() => expect(complete).toBeTypeOf('function'));
  const token = [...daemon.service.capabilities.keys()][0];
  const question = {
    content: 'Which fictional location should I research, and why?',
    kind: 'attention',
  };
  const result = await daemon.service.agentCall(token, 'notify_user', question);
  expect(result.message).toMatchObject({
    from: 'scout',
    to: 'user',
    threadId: 'scout',
    runId: run.id,
    notification: 'attention',
    content: question.content,
  });
  expect(daemon.service.board.events()[0]).toMatchObject({ version: 10, kind: 'message' });
  await expect(
    daemon.service.agentCall(token, 'notify_user', { ...question, roleId: 'writer' }),
  ).rejects.toThrow();
  await expect(
    daemon.service.agentCall(token, 'notify_user', { content: ' ', kind: 'attention' }),
  ).rejects.toThrow();
  await daemon.service.agentCall(token, 'notify_user', {
    content: 'Useful update.',
    kind: 'message',
  });
  await daemon.service.agentCall(token, 'notify_user', question);
  await expect(daemon.service.agentCall(token, 'notify_user', question)).rejects.toThrow('Three');
  daemon.service.board.rebuild();
  expect(
    daemon.service.board.list<ChatMessage>('message').filter((m) => m.notification),
  ).toHaveLength(3);
  expect(daemon.service.board.list('approval')).toEqual([]);
  expect(daemon.service.board.list('task')).toEqual([]);
  complete({ reply: 'I will continue after your answer.' });
  await finish(request, run.id);
  await vi.waitFor(() => expect(daemon.service.capabilities.has(token)).toBe(false));
  await expect(daemon.service.agentCall(token, 'notify_user', question)).rejects.toThrow('expired');
});
