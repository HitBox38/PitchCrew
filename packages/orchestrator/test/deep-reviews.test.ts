import { assessment, deepReviewFixture as fixture } from './helpers/deep-reviews.ts';
import { adapters } from '@pitchcrew/adapters';
import type { DeepReview, Run, RunContext } from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, finish, setup } from './helpers/daemon.ts';

afterEach(cleanup);
it('creates an initial draft, applies seven perspectives and rechecks without exporting', async () => {
  const { daemon, request, card } = await fixture(24501);
  const originalRun = adapters.demo.run.bind(adapters.demo);
  const stages: string[] = [];
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    stages.push(context.deepReview!.stage);
    expect(JSON.stringify(context.card)).not.toContain('RAW-SOURCE-DIRECTIVE');
    if (context.role.workflow === 'reviewer')
      return { role: 'reviewer', passed: true, feedback: [], assessment: assessment() };
    return originalRun(context);
  });
  const started = await request<Run>(`/cards/${card.id}/deep-reviews`, 'POST', {});
  expect(started.response.status).toBe(202);
  const snapshot = await finish(request, started.result.id);
  expect(stages).toEqual(['draft', 'review', 'recheck']);
  expect(snapshot.cards.find((c) => c.id === card.id)?.state).toBe('agreed');
  expect(snapshot.approvals).toHaveLength(0);
  const reports = (await request<{ reviews: DeepReview[] }>(`/cards/${card.id}/deep-reviews`))
    .result.reviews;
  const report = (
    await request<{ report: DeepReview }>(`/cards/${card.id}/deep-reviews/${reports[0]!.id}`)
  ).result.report;
  expect(report.before?.perspectives).toHaveLength(7);
  expect(report.after?.perspectives).toHaveLength(7);
  expect(report.originalResume).toContain('Built a React interface.');
  expect(report.finalResume).toBe(report.originalResume);
  expect(daemon.service.controllers.size).toBe(0);
});
it('keeps advisory findings from blocking the final packet and runs Writer corrections', async () => {
  const { request, card } = await fixture(24502);
  const originalRun = adapters.demo.run.bind(adapters.demo);
  const stages: string[] = [];
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    stages.push(context.deepReview!.stage);
    if (context.role.workflow === 'reviewer') {
      const result = assessment();
      result.findings.push({
        severity: 'advisory',
        quote: 'Built a React interface.',
        reason: 'Could emphasize this experience earlier.',
        correction: 'Keep the supported achievement near the top.',
        perspectives: ['recruiter'],
      });
      return { role: 'reviewer', passed: true, feedback: [], assessment: result };
    }
    return originalRun(context);
  });
  const run = (await request<Run>(`/cards/${card.id}/deep-reviews`, 'POST', {})).result;
  const snapshot = await finish(request, run.id);
  expect(stages).toEqual(['draft', 'review', 'correction', 'recheck']);
  expect(snapshot.cards.find((c) => c.id === card.id)?.state).toBe('agreed');
});
it('rejects unconfirmed context without starting any review', async () => {
  const { daemon, request } = await setup(24503);
  const card = daemon.service.createCard({ company: 'Fixture', title: 'Engineer' });
  daemon.service.moveCard(card.id, 'shortlisted');
  const response = await request(`/cards/${card.id}/deep-reviews`, 'POST', {});
  expect(response.response.status).toBe(400);
  expect(daemon.service.board.list('deep_review')).toHaveLength(0);
});
it('runs more than two targeted subagents and records parent deadline extensions', async () => {
  const { daemon, request, card } = await fixture(24504);
  const originalRun = adapters.demo.run.bind(adapters.demo);
  const children: RunContext[] = [];
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    if (context.role.workflow === 'writer') return originalRun(context);
    if (context.deepReview?.subagent) {
      children.push(context);
      expect(context.deepReview.maxConcurrentSubagents).toBe(0);
      return {
        role: 'reviewer',
        passed: true,
        feedback: [],
        assessment: {
          ...assessment(),
          perspectives: [
            {
              ...assessment().perspectives[0]!,
              perspective: context.deepReview.subagent.perspective,
            },
          ],
        },
      };
    }
    if (context.deepReview?.stage === 'review') {
      const token = context.mcp.env.PITCHCREW_RUN_TOKEN!;
      await daemon.service.agentCall(token, 'extend_review_deadline', {
        minutes: 10,
        reason: 'Need to complete targeted evidence checks.',
      });
      for (const perspective of ['relevance', 'impact', 'collaboration'])
        await daemon.service.agentCall(token, 'start_review_subagent', {
          perspective,
          focus: 'Inspect supported experience for this specific concern.',
          reason: 'An additional targeted evidence check would help.',
        });
      for (let i = 0; i < 10; i++) {
        const state = await daemon.service.agentCall(token, 'review_subagents', { waitMs: 100 });
        if ((state.subagents as { status: string }[]).every((child) => child.status !== 'running'))
          break;
      }
    }
    return { role: 'reviewer', passed: true, feedback: [], assessment: assessment() };
  });
  const run = (await request<Run>(`/cards/${card.id}/deep-reviews`, 'POST', {})).result;
  await finish(request, run.id);
  expect(children).toHaveLength(3);
  const report = daemon.service.board.list<DeepReview>('deep_review')[0]!;
  expect(report.extensions).toEqual([expect.objectContaining({ minutes: 10 })]);
  expect(daemon.service.board.list('review_subagent')).toHaveLength(3);
});
