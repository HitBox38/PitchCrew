import { adapters } from '@pitchcrew/adapters';
import type { Approval, Card, ExtractedJob, Run } from '@pitchcrew/core';
import { promptFor } from '../../adapters/src/process.ts';
import { packet } from '../../board/test/fixtures/packet.ts';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, confirmFixtureApplication, finish, setup } from './helpers/daemon.ts';
import * as documents from '../src/quality/documents.ts';
import { reviewSummary } from './helpers/review-summary.ts';

afterEach(cleanup);

type Daemon = Awaited<ReturnType<typeof setup>>['daemon'];
/** An ordinary chat turn attached to the job, as when the user asks Reviewer in its job chat. */
const chatTurn = (daemon: Daemon, roleId: string, cardId: string) => {
  const id = `chat-${roleId}-${daemon.service.board.events().length}`;
  const run = {
    id,
    cardId,
    roleId,
    runtime: 'demo',
    mode: 'chat',
    status: 'running',
    message: 'Fixture chat turn',
    startedAt: new Date().toISOString(),
    finishedAt: null,
  } satisfies Run;
  daemon.service.board.record('run', run, roleId, 'Fixture');
  daemon.service.controllers.set(id, new AbortController());
  daemon.service.capabilities.set(`token-${id}`, { runId: id, roleId, cardId });
  return {
    token: `token-${id}`,
    end: () => {
      daemon.service.controllers.delete(id);
      daemon.service.board.record(
        'run',
        { ...run, status: 'completed', finishedAt: new Date().toISOString() },
        roleId,
        'Fixture done',
      );
    },
  };
};

it('saves chat Reviewer blocking feedback for the same-context Writer revision only', async () => {
  const { daemon, request } = await setup();
  const board = daemon.service.board;
  const profile = [{ name: 'profile.md', content: 'Built React interfaces.' }];
  await request('/profile', 'PUT', profile[0]);
  const card = daemon.service.createCard({ company: 'Fictional chat review', title: 'Engineer' });
  const other = daemon.service.createCard({ company: 'Other fixture', title: 'Engineer' });
  daemon.service.moveCard(card.id, 'shortlisted');
  await confirmFixtureApplication(request, card.id);
  board.move(card.id, 'drafting', 'user');
  await daemon.service.applyResult(
    card.id,
    board.get('role', 'writer'),
    { role: 'writer', packet },
    profile,
  );
  await daemon.service.applyResult(
    card.id,
    board.get('role', 'reviewer'),
    { role: 'reviewer', passed: true, feedback: [], summary: reviewSummary() },
    profile,
  );
  expect(board.get<Card>('card', card.id).packetReview).toBeDefined();
  const approval = (await request<Approval>(`/cards/${card.id}/approval`, 'POST', {})).result;
  expect(approval.status).toBe('pending');

  const reviewer = chatTurn(daemon, 'reviewer', card.id);
  const scout = chatTurn(daemon, 'scout', card.id);
  const agent = <T>(token: string, body: unknown) =>
    request<T & { error?: string }>('/agent', 'POST', body, { authorization: `Bearer ${token}` });
  const feedback = ['Quote the allowlist exception exactly in the cover letter.'];
  const review = { feedback, suggestions: ['Shorten the opening sentence.'] };
  const before = board.events().length;
  const rejected = [
    [reviewer.token, { state: 'agreed', review }, 'when requesting changes'],
    [reviewer.token, { state: 'changes_requested', review: { feedback: [], suggestions: ['x'] } }],
    [reviewer.token, { state: 'changes_requested', review: { feedback, invented: true } }],
    [reviewer.token, { state: 'changes_requested', review, cardId: other.id }, 'attached job'],
    [scout.token, { state: 'changes_requested', review }, 'Reviewer seat'],
  ] as const;
  for (const [token, body, error] of rejected) {
    const result = await agent(token, { action: 'workflow', reason: 'Needs fixes', ...body });
    expect(result.response.status).toBeGreaterThanOrEqual(400);
    if (error) expect(result.result.error).toContain(error);
  }
  expect(board.events()).toHaveLength(before);
  scout.end();

  const saved = await agent<{ card: Card }>(reviewer.token, {
    action: 'workflow',
    state: 'changes_requested',
    reason: 'The cover letter misstates a claim.',
    review,
  });
  expect(saved.response.status).toBe(200);
  const expected = [...feedback, 'Warning: Shorten the opening sentence.'];
  for (const current of [saved.result.card, board.get<Card>('card', card.id)]) {
    expect(current).toMatchObject({ state: 'changes_requested', feedback: expected });
    expect(current.packetReview).toBeUndefined();
  }
  expect(board.get<Approval>('approval', approval.id).status).toBe('rejected');
  board.rebuild();
  expect(board.get<Card>('card', card.id).feedback).toEqual(expected);
  reviewer.end();

  vi.spyOn(documents, 'inspectPacketDocuments').mockResolvedValue({
    reports: [],
    errors: [],
    warnings: [],
    repairable: [],
  });
  const calls: string[] = [];
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    calls.push(context.purpose!);
    if (context.purpose === 'application-review') {
      expect(context.card.feedback).toEqual([]);
      return { role: 'reviewer', passed: true, feedback: [], summary: reviewSummary() };
    }
    expect(context.card.feedback).toEqual(expected);
    expect(promptFor(context)).toContain(feedback[0]);
    return { role: 'writer', packet };
  });
  for (const roleId of ['writer', 'reviewer']) {
    const { result } = await request<Run>(`/cards/${card.id}/run`, 'POST', { roleId });
    await finish(request, result.id);
  }
  expect(calls).toEqual(['application-draft', 'application-review']);
  expect(board.get<Card>('card', card.id).state).toBe('agreed');

  // A brief confirmed after drafting makes the packet stale: no review can be saved against it.
  const source = (
    await request<{ sourceRevision: string; context: { revision: string } }>(
      `/cards/${card.id}/application-context`,
    )
  ).result;
  const changed: ExtractedJob = {
    brief: {
      companyContext: 'Fictional fixture employer, revised.',
      responsibilities: ['Build interfaces.'],
      qualifications: ['React and TypeScript.'],
      constraints: [],
    },
    requirements: [],
    flagged: [],
    form: { status: 'manual' },
  };
  const confirmed = await request(`/cards/${card.id}/application-context/confirm`, 'POST', {
    sourceRevision: source.sourceRevision,
    expectedRevision: source.context.revision,
    context: changed,
  });
  expect(confirmed.response.status).toBe(200);
  const stale = chatTurn(daemon, 'reviewer', card.id);
  const staleBefore = board.get<Card>('card', card.id);
  const result = await agent(stale.token, {
    action: 'workflow',
    state: 'changes_requested',
    reason: 'Stale review',
    review,
  });
  expect(result.result.error).toContain('current confirmed brief');
  expect(board.get<Card>('card', card.id)).toEqual(staleBefore);
  stale.end();
});
