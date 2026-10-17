import { adapters } from '@pitchcrew/adapters';
import type { ChatRequest, DeepReview } from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, waitForSnapshot } from './helpers/daemon.ts';
import { assessment, deepReviewFixture } from './helpers/deep-reviews.ts';
afterEach(cleanup);
function mockReview() {
  const original = adapters.demo.run.bind(adapters.demo);
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) =>
    context.role.workflow === 'reviewer'
      ? { role: 'reviewer', passed: true, feedback: [], assessment: assessment() }
      : original(context),
  );
}
it('starts the managed flow from a natural chat request on an attached job', async () => {
  const { daemon, request, card } = await deepReviewFixture(24521);
  mockReview();
  const conversation = daemon.service.createConversation({
    title: 'Fictional review',
    participants: ['reviewer'],
    cardId: card.id,
  });
  const sent = await daemon.service.sendConversation(conversation.id, {
    content: 'Please deep review my resume',
  });
  expect(sent.deepReviewRequest?.cardId).toBe(card.id);
  await waitForSnapshot(
    request,
    () => daemon.service.board.list<DeepReview>('deep_review')[0]?.status === 'completed',
  );
  expect(daemon.service.board.get<ChatRequest>('chat_request', sent.id).deliveries[0]!.status).toBe(
    'completed',
  );
});
it('asks for a job when /hiring-panel is requested without one, then runs the selected application', async () => {
  const { daemon, request, card } = await deepReviewFixture(24522);
  mockReview();
  const conversation = daemon.service.createConversation({
    title: 'Choose a job',
    participants: ['reviewer'],
  });
  const sent = await daemon.service.sendConversation(conversation.id, { content: '/hiring-panel' });
  expect(sent.deliveries[0]!.status).toBe('waiting');
  const snapshot = await waitForSnapshot(
    request,
    (snapshot) => snapshot.userInputs?.some((q) => q.status === 'pending') === true,
  );
  const question = snapshot.userInputs!.find((q) => q.status === 'pending')!;
  expect(question.options.some((option) => option.id === card.id)).toBe(true);
  const answer = await request(`/user-input/${question.id}/answer`, 'POST', {
    selected: [card.id],
  });
  expect(answer.response.status).toBe(202);
  await waitForSnapshot(
    request,
    () => daemon.service.board.list<DeepReview>('deep_review')[0]?.status === 'completed',
  );
  expect(daemon.service.board.list<DeepReview>('deep_review')[0]!.cardId).toBe(card.id);
});
it('preserves an explicit chat request for targeted subagents', async () => {
  const { daemon, request, card } = await deepReviewFixture(24523);
  const original = adapters.demo.run.bind(adapters.demo);
  let requested = false;
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    if (context.deepReview?.subagent) {
      requested = context.deepReview.subagent.perspective === 'impact';
      return original(context);
    }
    return context.role.workflow === 'reviewer'
      ? { role: 'reviewer', passed: true, feedback: [], assessment: assessment() }
      : original(context);
  });
  const conversation = daemon.service.createConversation({
    title: 'Explicit second opinion',
    participants: ['reviewer'],
    cardId: card.id,
  });
  await daemon.service.sendConversation(conversation.id, {
    content: '/hiring-panel with impact subagents',
  });
  await waitForSnapshot(
    request,
    () => daemon.service.board.list<DeepReview>('deep_review')[0]?.status === 'completed',
  );
  expect(
    daemon.service.board.list<DeepReview>('deep_review')[0]?.options.requestedPerspectives,
  ).toEqual(['impact']);
  expect(requested).toBe(true);
});
