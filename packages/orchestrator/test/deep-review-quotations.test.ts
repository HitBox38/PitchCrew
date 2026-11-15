import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { adapters } from '@pitchcrew/adapters';
import type { Card, DeepReview, Run, RunResult } from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import { assessmentFor, ReviewQuotationError } from '../src/crew/deep-reviews/assessment.ts';
import { deepReviewInstructions } from '../../adapters/src/process/deep-review-prompts.ts';
import { assessment, deepReviewFixture } from './helpers/deep-reviews.ts';
import { cleanup, finish, waitForSnapshot } from './helpers/daemon.ts';
import { reviewSummary } from './helpers/review-summary.ts';

afterEach(cleanup);
const resultFor = (quote?: string): RunResult => {
  const value = assessment();
  if (quote)
    value.findings.push({
      severity: 'advisory',
      quote,
      reason: 'Clarify this passage.',
      correction: 'Preserve the verified facts.',
      perspectives: ['screen'],
    });
  return {
    role: 'reviewer',
    passed: true,
    feedback: [],
    summary: reviewSummary(),
    assessment: value,
  };
};

// Fictional reduction of the saved Markdown/whole-packet input shape. The rejected
// parent quotation was not retained by 0.17.0; this is not its recovered output.
const resume =
  '# Fictional Candidate\r\n\r\n- Built **Echo**, an **Electron** app for local transcription/Q&A.\r\n- Led React 18→19 upgrades for café teams.';
it('accepts exact Markdown and Unicode passages without changing the returned quotations', () => {
  const quote = 'Built **Echo**, an **Electron** app for local transcription/Q&A.';
  const result = resultFor(quote);
  if (result.role === 'reviewer') result.assessment!.perspectives[0]!.weakestLine = 'React 18→19';
  expect(assessmentFor(result, resume).findings[0]!.quote).toBe(quote);
});
it.each([
  'Built Echo, an Electron app for local transcription/Q&A.',
  'React 18->19',
  'cafe\u0301 teams',
  'local  transcription/Q&A',
  'Built **Echo** … local transcription/Q&A.',
  'Email *',
  'Invented leadership achievement.',
])('rejects unsupported or altered quotation %s with an actionable field diagnostic', (quote) => {
  expect(() => assessmentFor(resultFor(quote), resume)).toThrow(ReviewQuotationError);
  expect(() => assessmentFor(resultFor(quote), resume)).toThrow('findings[0].quote');
});
it('checks weakest lines and keeps explicit missing-section findings valid', () => {
  expect(assessmentFor(resultFor('[MISSING: direct contact email]'), resume).findings).toHaveLength(
    1,
  );
  const result = resultFor();
  if (result.role === 'reviewer')
    result.assessment!.perspectives[0]!.weakestLine = 'Fabricated line';
  expect(() => assessmentFor(result, resume)).toThrow('perspectives[0].weakestLine');
});

it('retains rejected output, repairs once against unchanged bytes and preserves before/after provenance', async () => {
  const { daemon, request, card, directory } = await deepReviewFixture();
  const original = adapters.demo.run.bind(adapters.demo);
  let calls = 0;
  const inputs: string[] = [];
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    if (context.role.workflow === 'writer') return original(context);
    inputs.push(context.card.packet!.resume);
    if (context.deepReview!.stage === 'review') {
      calls++;
      if (calls === 1) return resultFor('Unsupported packet quotation');
      expect(context.deepReview!.quotationRepair).toContain('findings[0].quote');
      expect(deepReviewInstructions(context)).toContain('single quotation-repair attempt');
      expect(daemon.service.board.list<DeepReview>('deep_review')[0]!.before).toBeUndefined();
    }
    return resultFor();
  });
  const run = (await request<Run>(`/cards/${card.id}/deep-reviews`, 'POST', {})).result;
  await finish(request, run.id);
  expect(calls).toBe(2);
  expect(new Set(inputs).size).toBe(1);
  const report = daemon.service.board.list<DeepReview>('deep_review')[0]!;
  expect(report.status).toBe('completed');
  expect(report.originalResume).toBe(inputs[0]);
  expect(report.finalResume).toBe(inputs[0]);
  expect(report.before?.perspectives).toHaveLength(7);
  expect(report.after?.perspectives).toHaveLength(7);
  const stages = daemon.service.board
    .list<Run>('run')
    .filter((r) => r.deepReviewId === report.id && r.reviewStage === 'review');
  expect(stages.map((r) => r.status)).toEqual(['failed', 'completed']);
  expect(stages[0]!.inputPacketDigest).toBe(stages[1]!.inputPacketDigest);
  const folder = join(directory, 'roles', 'reviewer', 'runs', stages[0]!.id);
  const input = JSON.parse(await readFile(join(folder, 'deep-review-input.json'), 'utf8'));
  const output = JSON.parse(await readFile(join(folder, 'deep-review-output.json'), 'utf8'));
  expect(input).toMatchObject({
    runId: stages[0]!.id,
    inputPacketDigest: stages[0]!.inputPacketDigest,
    contextRevision: report.contextRevision,
    profileDigest: report.profileDigest,
  });
  expect(input.card.packet.resume).toBe(report.originalResume);
  expect(output.assessment.findings[0].quote).toBe('Unsupported packet quotation');
  daemon.service.board.rebuild();
  expect(daemon.service.board.get<Run>('run', stages[0]!.id).status).toBe('failed');
});

it('stops after one failed repair without adopting an incomplete review or launching Writer corrections', async () => {
  const { daemon, request, card } = await deepReviewFixture();
  const original = adapters.demo.run.bind(adapters.demo);
  const stages: string[] = [];
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    stages.push(context.deepReview!.stage);
    return context.role.workflow === 'writer' ? original(context) : resultFor('Unsupported quote');
  });
  const run = (await request<Run>(`/cards/${card.id}/deep-reviews`, 'POST', {})).result;
  await waitForSnapshot(request, (snapshot) =>
    snapshot.runs.some((r) => r.id === run.id && r.status === 'failed'),
  );
  expect(stages).toEqual(['draft', 'review', 'review']);
  const report = daemon.service.board.list<DeepReview>('deep_review')[0]!;
  expect(report.error).toContain('quotation-repair allowance is exhausted');
  expect(report.before).toBeUndefined();
  expect(report.after).toBeUndefined();
  const current = daemon.service.board.get<Card>('card', card.id);
  expect(current.state).toBe('changes_requested');
  expect(current.packetReview).toBeUndefined();
  expect(daemon.service.board.list('approval')).toHaveLength(0);
});

it('validates the recheck against Writer corrections and retains both resume versions', async () => {
  const { daemon, request, card, directory } = await deepReviewFixture();
  const original = adapters.demo.run.bind(adapters.demo);
  let rechecks = 0;
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    if (context.role.workflow === 'writer') {
      const output = await original(context);
      if (output.role === 'writer' && context.deepReview!.stage === 'correction')
        output.packet.resume = output.packet.resume.replace(
          '## Application for Engineer',
          '## Experience',
        );
      return output;
    }
    if (context.deepReview!.stage === 'review') return resultFor('## Application for Engineer');
    rechecks++;
    expect(context.card.packet!.resume).toContain('## Experience');
    return resultFor(rechecks === 1 ? '## Application for Engineer' : undefined);
  });
  const run = (await request<Run>(`/cards/${card.id}/deep-reviews`, 'POST', {})).result;
  await finish(request, run.id);
  const report = daemon.service.board.list<DeepReview>('deep_review')[0]!;
  expect(report.originalResume).toContain('## Application for Engineer');
  expect(report.finalResume).toContain('## Experience');
  expect(report.inputPacketDigest).not.toBe(report.finalPacketDigest);
  expect(rechecks).toBe(2);
  const rejected = daemon.service.board
    .list<Run>('run')
    .find(
      (r) => r.deepReviewId === report.id && r.reviewStage === 'recheck' && r.status === 'failed',
    )!;
  const input = JSON.parse(
    await readFile(
      join(directory, 'roles', 'reviewer', 'runs', rejected.id, 'deep-review-input.json'),
      'utf8',
    ),
  );
  expect(input.card.packet.resume).toBe(report.finalResume);
  expect(input.inputPacketDigest).toBe(report.finalPacketDigest);
});
