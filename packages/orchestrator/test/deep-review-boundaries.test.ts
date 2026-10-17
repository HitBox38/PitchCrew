import { adapters } from '@pitchcrew/adapters';
import type { Card, DeepReview, Role, Run, ReviewSubagent, Snapshot } from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, finish, waitForSnapshot } from './helpers/daemon.ts';
import { assessment, deepReviewFixture } from './helpers/deep-reviews.ts';
afterEach(cleanup);
const passing = () => ({
  role: 'reviewer' as const,
  passed: true,
  feedback: [],
  assessment: assessment(),
});
it('keeps blockers authoritative even when a model incorrectly sets passed=true', async () => {
  const { daemon, request, card } = await deepReviewFixture(24551);
  const original = adapters.demo.run.bind(adapters.demo);
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    if (context.role.workflow === 'writer') return original(context);
    const result = passing();
    result.assessment.findings.push({
      severity: 'blocking',
      quote: '[MISSING: required answer]',
      reason: 'A required application answer is unresolved.',
      correction: 'Ask the user before completing the application.',
      perspectives: ['screen'],
    });
    return result;
  });
  const run = (await request<Run>(`/cards/${card.id}/deep-reviews`, 'POST', {})).result;
  await finish(request, run.id);
  expect(daemon.service.board.get<Card>('card', card.id)).toMatchObject({
    state: 'changes_requested',
  });
  expect(daemon.service.board.get<Card>('card', card.id).packetReview).toBeUndefined();
  expect(daemon.service.board.list<DeepReview>('deep_review')[0]!.status).toBe('needs_changes');
});
it('rejects stale packet results without overwriting a concurrent edit', async () => {
  const { daemon, request, card } = await deepReviewFixture(24552);
  const original = adapters.demo.run.bind(adapters.demo);
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    if (context.role.workflow === 'writer') return original(context);
    const current = daemon.service.board.get<Card>('card', card.id);
    daemon.service.board.updateCard(
      card.id,
      { packet: { ...current.packet!, resume: 'Concurrent fictional edit.' } },
      'user',
      'Fixture simulates an outside edit',
    );
    return passing();
  });
  const run = (await request<Run>(`/cards/${card.id}/deep-reviews`, 'POST', {})).result;
  await waitForSnapshot(
    request,
    (snapshot) => snapshot.runs.find((r) => r.id === run.id)?.status === 'failed',
  );
  expect(daemon.service.board.get<Card>('card', card.id).packet?.resume).toBe(
    'Concurrent fictional edit.',
  );
  expect(daemon.service.board.list<DeepReview>('deep_review')[0]!.error).toContain(
    'Packet changed',
  );
});
it('uses only explicitly configured model alternatives and preserves specialist attribution', async () => {
  const { daemon, request, card } = await deepReviewFixture(24553);
  const original = adapters.demo.run.bind(adapters.demo);
  let inherited = '';
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    if (context.role.workflow === 'writer') return original(context);
    if (context.deepReview?.subagent) {
      inherited = context.role.model;
      expect(context.card.packet?.note).toBe('');
      expect(context.card.feedback).toEqual([]);
      expect(context.deepReview.findings).toBeUndefined();
      return {
        ...passing(),
        assessment: {
          ...assessment(),
          perspectives: [{ ...assessment().perspectives[0]!, perspective: 'impact' }],
        },
      };
    }
    if (context.deepReview?.stage === 'review') {
      const token = context.mcp.env.PITCHCREW_RUN_TOKEN!;
      await expect(
        daemon.service.agentCall(token, 'start_review_subagent', {
          alternative: 1,
          perspective: 'impact',
          focus: 'Inspect supported impact.',
          reason: 'Need a targeted impact opinion.',
        }),
      ).rejects.toThrow('explicitly user-configured');
      await daemon.service.agentCall(token, 'start_review_subagent', {
        alternative: 0,
        perspective: 'impact',
        focus: 'Inspect supported impact.',
        reason: 'Need a targeted impact opinion.',
      });
      for (let i = 0; i < 10; i++) {
        const state = await daemon.service.agentCall(token, 'review_subagents', { waitMs: 100 });
        if ((state.subagents as ReviewSubagent[]).every((child) => child.status !== 'running'))
          break;
      }
      const result = passing();
      result.assessment.findings.push({
        severity: 'advisory',
        quote: 'Built a React interface.',
        reason: 'Consider emphasizing this supported work.',
        correction: 'Keep this achievement prominent.',
        perspectives: ['impact'],
      });
      return result;
    }
    return passing();
  });
  const run = (
    await request<Run>(`/cards/${card.id}/deep-reviews`, 'POST', {
      alternatives: [{ runtime: 'demo', model: 'explicit-fictional-model' }],
    })
  ).result;
  await finish(request, run.id);
  expect(inherited).toBe('explicit-fictional-model');
  expect(
    daemon.service.board.list<DeepReview>('deep_review')[0]!.before?.findings[0]!.perspectives,
  ).toEqual(['impact']);
});
it('rechecks current delegation permission instead of relying on the starting role snapshot', async () => {
  const { daemon, request, card } = await deepReviewFixture(24554);
  const original = adapters.demo.run.bind(adapters.demo);
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    if (context.role.workflow === 'writer') return original(context);
    if (context.deepReview?.stage === 'review') {
      const role = daemon.service.board.get<Role>('role', 'reviewer');
      daemon.service.board.record(
        'role',
        { ...role, capabilities: { ...role.capabilities!, invokeAgents: false } },
        'user',
        'Revoke delegation during fixture',
      );
      await expect(
        daemon.service.agentCall(context.mcp.env.PITCHCREW_RUN_TOKEN!, 'start_review_subagent', {
          perspective: 'impact',
          focus: 'Inspect supported impact.',
          reason: 'Need a targeted impact opinion.',
        }),
      ).rejects.toThrow('invocation is disabled');
    }
    return passing();
  });
  const run = (await request<Run>(`/cards/${card.id}/deep-reviews`, 'POST', {})).result;
  await finish(request, run.id);
  expect(daemon.service.board.list('review_subagent')).toHaveLength(0);
});
it('retains reports through projection rebuild and fetches large prose only in report views for workspace clients', async () => {
  const { daemon, request, card } = await deepReviewFixture(24555);
  const original = adapters.demo.run.bind(adapters.demo);
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) =>
    context.role.workflow === 'writer' ? original(context) : passing(),
  );
  const run = (await request<Run>(`/cards/${card.id}/deep-reviews`, 'POST', {})).result;
  await finish(request, run.id);
  const saved = daemon.service.board.list<DeepReview>('deep_review')[0]!;
  daemon.service.board.rebuild();
  expect(daemon.service.board.get<DeepReview>('deep_review', saved.id)).toEqual(saved);
  const workspace = (await request<Snapshot>('/snapshot?view=workspace')).result;
  const event = workspace.events.find((e) => e.kind === 'deep_review');
  // The workspace snapshot deliberately omits report bodies, while the dedicated route retains them.
  if (workspace.workspace) expect((event?.data as DeepReview | undefined)?.before).toBeUndefined();
  const detail = await request<{ report: DeepReview }>(
    `/cards/${card.id}/deep-reviews/${saved.id}`,
  );
  expect(detail.result.report.before?.perspectives).toHaveLength(7);
  expect(detail.result.report.originalResume).toContain('Built a React interface.');
});
it('deduplicates a native chat tool retry and ties its cancellation root to the originating request', async () => {
  const { daemon, request, card } = await deepReviewFixture(24556);
  const original = adapters.demo.run.bind(adapters.demo);
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) =>
    context.role.workflow === 'writer' ? original(context) : passing(),
  );
  let ids: string[] = [];
  vi.spyOn(adapters.demo, 'chat').mockImplementation(async (context) => {
    const token = context.mcp.env.PITCHCREW_RUN_TOKEN!;
    const first = await daemon.service.agentCall(token, 'start_deep_review', {});
    const second = await daemon.service.agentCall(token, 'start_deep_review', {});
    ids = [(first.run as Run).id, (second.run as Run).id];
    return { reply: 'Started the requested managed review.' };
  });
  const conversation = daemon.service.createConversation({
    title: 'Native request',
    participants: ['reviewer'],
    cardId: card.id,
  });
  await daemon.service.sendConversation(conversation.id, {
    content: 'Please inspect this application carefully.',
  });
  await waitForSnapshot(
    request,
    () => daemon.service.board.list<DeepReview>('deep_review')[0]?.status === 'completed',
  );
  expect(ids).toHaveLength(2);
  expect(ids[0]).toBe(ids[1]);
  expect(daemon.service.board.list<DeepReview>('deep_review')).toHaveLength(1);
});
it('schedules all user-requested perspectives, including more than concurrent capacity, before parent synthesis', async () => {
  const { daemon, request, card } = await deepReviewFixture(24557);
  const original = adapters.demo.run.bind(adapters.demo);
  const perspectives = ['screen', 'readiness', 'relevance', 'impact', 'collaboration'] as const;
  let running = 0;
  let peak = 0;
  const seen: string[] = [];
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    if (context.role.workflow === 'writer') return original(context);
    if (context.deepReview?.subagent) {
      running++;
      peak = Math.max(peak, running);
      const perspective = context.deepReview.subagent.perspective;
      seen.push(perspective);
      await new Promise((resolve) => setTimeout(resolve, 25));
      running--;
      const item = assessment().perspectives.find((item) => item.perspective === perspective) ?? {
        ...assessment().perspectives[0]!,
        perspective,
        verdict: 'MAYBE' as const,
      };
      return { ...passing(), assessment: { ...assessment(), perspectives: [item] } };
    }
    if (context.deepReview?.stage === 'review')
      expect(
        context.deepReview.secondOpinionResults?.filter((item) => item.status === 'completed'),
      ).toHaveLength(5);
    return passing();
  });
  const run = (
    await request<Run>(`/cards/${card.id}/deep-reviews`, 'POST', {
      secondOpinions: true,
      requestedPerspectives: perspectives,
    })
  ).result;
  await finish(request, run.id);
  expect(seen.sort()).toEqual([...perspectives].sort());
  expect(peak).toBeLessThanOrEqual(4);
  expect(daemon.service.board.list<ReviewSubagent>('review_subagent')).toHaveLength(5);
});
