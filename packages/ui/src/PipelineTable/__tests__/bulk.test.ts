import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Card, ChatRequest, Snapshot } from '@pitchcrew/core';
import { api } from '@/api.ts';
import { ApiHttpError } from '@/api-errors.ts';
import { attentionItems } from '@/lib/attention.ts';
import { clockLabel } from '@/lib/time.ts';
import {
  ago,
  brief,
  card,
  delivery,
  profileProposal,
  question,
  queue,
  request,
  roles,
  run,
  snapshot,
} from '@/lib/__tests__/attention-fixture.ts';
import { sendFits } from '../api.ts';
import { fitOutcomes, outcomeParts, planFits, settledIds, workspaceBlocker } from '../bulk.ts';

vi.mock('@/api.ts', () => ({ api: vi.fn() }));
afterEach(() => vi.mocked(api).mockReset());

const fit = (id: string, status: 'queued' | 'failed' = 'queued', runId: string | null = null) =>
  request(`fit-${id}`, {
    boardAction: 'fit',
    content: 'Evaluate fit',
    deliveries: [delivery('scout', status, runId)],
  });
const lead = (id: string, fields: Partial<Card> = {}) =>
  card(id, { company: id[0]!.toUpperCase() + id.slice(1), applicationContext: brief(), ...fields });

/** A ready workspace: Scout on an available isolating runtime, profile notes, one busy slot. */
const workspace = (fields: Partial<Snapshot> = {}): Snapshot =>
  snapshot({
    runtimes: [{ id: 'demo', available: true, applicationIsolation: true }] as Snapshot['runtimes'],
    profile: [{ name: 'profile.md', content: 'Fictional notes.' }] as Snapshot['profile'],
    ...fields,
  });

const classes = () => {
  const busy = run('run-halcyon', { cardId: 'halcyon', roleId: 'reviewer' });
  const scouting = run('run-lumen', { cardId: 'lumen', roleId: 'scout', purpose: 'fit' });
  const chatting = run('run-chat', { cardId: 'chatty', roleId: 'writer' });
  const finished = run('run-corvid', {
    cardId: 'corvid',
    roleId: 'scout',
    status: 'failed',
    purpose: 'fit',
    startedAt: ago(60),
    finishedAt: ago(50),
  });
  return workspace({
    cards: [
      card('halcyon', { company: 'Halcyon', state: 'in_review' }),
      lead('bare', { applicationContext: undefined }),
      lead('lumen'),
      lead('chatty'),
      lead('owned', { owner: 'writer' }),
      lead('north'),
      lead('corvid'),
      lead('keystone'),
      lead('fresh'),
    ],
    runs: [busy, scouting, chatting, finished],
    queue: {
      concurrency: 3,
      active: 3,
      background: 0,
      queues: [
        queue('job:halcyon', { state: 'running', runs: [busy] }),
        queue('job:lumen', { state: 'running', runs: [scouting] }),
        queue('job:chatty', { state: 'running', runs: [chatting] }),
        queue('job:north', { requests: [fit('north')] }),
        queue('job:corvid', {
          state: 'paused',
          paused: true,
          pauseKind: 'failed',
          requests: [fit('corvid', 'failed', 'run-corvid')],
        }),
        queue('job:keystone', {
          state: 'paused',
          paused: true,
          pauseKind: 'failed',
          requests: [fit('keystone', 'failed')],
        }),
      ],
    },
  });
};
const all = ['halcyon', 'bare', 'lumen', 'chatty', 'owned', 'north', 'corvid', 'keystone', 'fresh'];
const plan = (data: Snapshot, ids: readonly string[]) => {
  const result = planFits(data, attentionItems(data), ids);
  if (result.blocker !== undefined) throw new Error(result.blocker);
  return result;
};

describe('bulk Evaluate fit', () => {
  it('classifies every selected job before anything is sent', () => {
    const data = classes();
    const result = plan(data, all);
    expect(result.send).toEqual(['fresh']);
    expect(
      Object.fromEntries([...result.outcomes].map(([id, outcome]) => [id, outcome.text])),
    ).toEqual({
      halcyon: 'Not sent · Evaluate fit needs a job in Leads.',
      bare: 'Not sent · Prepare the job brief first.',
      lumen: 'Already queued · Scout is evaluating it now',
      chatty: 'Not sent · Wait for this job’s active work to finish.',
      owned: 'Not sent · Wait for this job’s active work to finish.',
      north: 'Already queued · 1st in line',
      corvid: `Already queued · failed ${clockLabel(ago(50))}, waiting for Retry or Skip`,
      keystone: 'Already queued · failed, waiting for Retry or Skip',
    });
    expect(result.outcomes.get('lumen')?.bead).toBe('plum');
    expect(result.outcomes.get('corvid')?.bead).toBe('rose');
    expect(result.outcomes.get('bare')?.bead).toBeNull();
  });

  it('reports a fit that already runs or waits before a missing brief, as the Queue column does', () => {
    const scouting = run('run-lumen', { cardId: 'lumen', roleId: 'scout', purpose: 'fit' });
    const chatting = run('run-chatty', { cardId: 'chatty', roleId: 'writer' });
    const data = workspace({
      cards: [
        lead('lumen', { applicationContext: undefined }),
        lead('kite', { applicationContext: undefined }),
        lead('chatty'),
      ],
      runs: [scouting, chatting],
      queue: {
        concurrency: 2,
        active: 2,
        background: 0,
        queues: [
          queue('job:lumen', { state: 'running', runs: [scouting] }),
          queue('job:chatty', { state: 'running', runs: [chatting], requests: [fit('chatty')] }),
          queue('job:kite', { requests: [fit('kite')] }),
        ],
      },
    });
    const result = plan(data, ['lumen', 'kite', 'chatty']);
    expect(result.send).toEqual([]);
    expect(
      Object.fromEntries([...result.outcomes].map(([id, outcome]) => [id, outcome.text])),
    ).toEqual({
      lumen: 'Already queued · Scout is evaluating it now',
      kite: 'Already queued · 1st in line',
      chatty: 'Already queued · after the job’s current work',
    });
  });

  it('reports a fit held by a pause or a question while another run in its lane still executes', () => {
    const lane = (id: string, fields: Parameters<typeof queue>[1]) => {
      const busy = run(`run-${id}`, { cardId: id, roleId: 'writer' });
      return { busy, queue: queue(`job:${id}`, { state: 'running', runs: [busy], ...fields }) };
    };
    const paused = lane('pine', {
      paused: true,
      pauseKind: 'user',
      reason: 'Paused by you.',
      requests: [fit('pine')],
    });
    const stopped = lane('birch', {
      paused: true,
      pauseKind: 'failed',
      reason: 'Writer stopped before finishing.',
      requests: [
        request('draft-birch', { deliveries: [delivery('writer', 'failed')] }),
        fit('birch'),
      ],
    });
    const failedFit = lane('cedar', {
      paused: true,
      pauseKind: 'failed',
      requests: [fit('cedar', 'failed')],
    });
    const asked = lane('umbra', { requests: [fit('umbra')] });
    const lanes = [paused, stopped, failedFit, asked];
    const data = workspace({
      cards: ['pine', 'birch', 'cedar', 'umbra'].map((id) => lead(id)),
      runs: lanes.map((entry) => entry.busy),
      userInputs: [question('question-1', { runId: 'run-umbra' })],
      queue: { concurrency: 5, active: 4, background: 0, queues: lanes.map((e) => e.queue) },
    });
    const result = plan(data, ['pine', 'birch', 'cedar', 'umbra']);
    expect(result.send).toEqual([]);
    expect(
      Object.fromEntries([...result.outcomes].map(([id, outcome]) => [id, outcome.text])),
    ).toEqual({
      pine: 'Already queued · paused by you',
      birch: 'Already queued · on hold: Writer stopped before finishing.',
      cedar: 'Already queued · failed, waiting for Retry or Skip',
      umbra: 'Already queued · waiting for your answer',
    });
    expect(result.outcomes.get('birch')?.bead).toBe('rose');
    expect(result.outcomes.get('umbra')?.bead).toBe('ochre');
  });

  it('reports an existing fit its agent cannot start as held, never a place or "starting"', () => {
    // The seat check passes (the runtime is installed), but Scout's runtime waits for sign-in, so
    // the fit is out of the waiting line and no free slot will start it.
    const data = workspace({
      cards: [lead('north')],
      runtimeMaintenance: {
        enabled: true,
        automatic: false,
        checking: false,
        nextCheckAt: null,
        updates: [],
        authentication: [
          {
            runtime: 'demo',
            model: '',
            result: { status: 'missing', detail: '', checkedAt: ago(2), instructions: '' },
          },
        ],
      },
      queue: {
        concurrency: 2,
        active: 0,
        background: 0,
        queues: [queue('job:north', { requests: [fit('north')] })],
      },
    });
    expect(plan(data, ['north']).outcomes.get('north')).toMatchObject({
      text: 'Already queued · starts once you sign in to Demo in Settings',
      bead: 'ochre',
    });
  });

  it('stops the whole batch on a workspace reason, never on the first job’s', () => {
    const data = classes();
    // Lumen has a running fit, which the single action would offer to cancel without a reason.
    const noScout = { ...data, roles: roles.filter((role) => role.id !== 'scout') };
    expect(planFits(noScout, [], ['lumen', ...all])).toEqual({
      blocker: 'Enable an agent in the scout seat in Crew.',
    });
    const recovering = {
      ...data,
      profileProposals: [profileProposal('p', { status: 'applying' })],
    };
    expect(workspaceBlocker(recovering)).toBe(
      'Finish the approved profile update on Profile before starting runs or editing notes.',
    );
    expect(planFits(recovering, [], all)).toHaveProperty('blocker');
    expect(workspaceBlocker({ ...data, profile: [] })).toBe(
      'Add your profile notes before starting the crew.',
    );
  });

  it('reports an owned first job alone as not sent and queues the rest', async () => {
    const data = workspace({
      cards: [lead('owned', { owner: 'writer' }), lead('alpha'), lead('beta')],
    });
    const result = plan(data, ['owned', 'alpha', 'beta']);
    expect(result.send).toEqual(['alpha', 'beta']);
    const created = (_path: string, _method?: string, body?: unknown) =>
      Promise.resolve({ id: `new-${(body as { cardId: string }).cardId}` });
    vi.mocked(api).mockImplementation(created as unknown as typeof api);
    const sent = await sendFits(
      result.send,
      () => data,
      () => {},
    );
    expect(vi.mocked(api).mock.calls).toEqual([
      ['/queue/actions', 'POST', { cardId: 'alpha', action: 'fit' }],
      ['/queue/actions', 'POST', { cardId: 'beta', action: 'fit' }],
    ]);
    const after = workspace({
      ...data,
      queue: {
        concurrency: 1,
        active: 1,
        background: 0,
        queues: [
          queue('job:alpha', { requests: [request('new-alpha', { boardAction: 'fit' })] }),
          queue('job:beta', { requests: [request('new-beta', { boardAction: 'fit' })] }),
        ],
      },
    });
    const outcomes = fitOutcomes(after, [], result, sent, ['beta', 'alpha', 'owned']);
    expect(outcomes.map((outcome) => [outcome.company, outcome.text])).toEqual([
      ['Beta', 'Queued · 2nd in line'],
      ['Alpha', 'Queued · 1st in line'],
      ['Owned', 'Not sent · Wait for this job’s active work to finish.'],
    ]);
    expect(outcomeParts(outcomes)).toEqual([
      '3 jobs',
      '2 queued',
      '0 already queued',
      '1 not sent',
    ]);
    expect([...settledIds(outcomes)].toSorted()).toEqual(['alpha', 'beta']);
  });

  it('tells a returned existing request from a new one, and a refusal from a lost answer', async () => {
    const data = workspace({
      cards: [lead('alpha'), lead('beta'), lead('gamma'), lead('delta')],
      queue: {
        concurrency: 1,
        active: 0,
        background: 0,
        queues: [queue('job:alpha', { requests: [fit('alpha')] })],
      },
    });
    vi.mocked(api)
      .mockResolvedValueOnce({ id: 'fit-alpha' } as ChatRequest)
      .mockResolvedValueOnce({ id: 'new-beta' } as ChatRequest)
      .mockRejectedValueOnce(new ApiHttpError(404, 'card not found.'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const progress: number[] = [];
    const sent = await sendFits(
      ['alpha', 'beta', 'gamma', 'delta'],
      () => data,
      (done) => progress.push(done),
    );
    expect(progress).toEqual([0, 1, 2, 3, 4]);
    expect(Object.fromEntries(sent)).toEqual({
      alpha: { kind: 'existing', requestId: 'fit-alpha' },
      beta: { kind: 'queued', requestId: 'new-beta' },
      // The daemon's answer: it refused the job, so nothing was queued.
      gamma: { kind: 'error', message: 'card not found.' },
      // No answer at all: the call may have reached the daemon before the network failed.
      delta: { kind: 'unanswered', before: [] },
    });
    // The refresh failed, so the last snapshot is all there is, and it shows no request for delta.
    const outcomes = fitOutcomes(data, [], { outcomes: new Map(), send: [] }, sent, [
      'alpha',
      'beta',
      'gamma',
      'delta',
    ]);
    expect(outcomes.map((outcome) => [outcome.kind, outcome.text])).toEqual([
      ['existing', 'Already queued · starting'],
      ['queued', 'Queued · in its job queue'],
      ['unsent', 'Not sent · card not found.'],
      ['unconfirmed', 'No answer from Pitchcrew · check this job’s queue before retrying'],
    ]);
    expect(outcomes[3]?.bead).toBe('ochre');
    // Counted apart from "not sent"; it stays selected with the refused job, the others leave.
    expect(outcomeParts(outcomes)).toEqual([
      '4 jobs',
      '1 queued',
      '1 already queued',
      '1 not sent',
      '1 unconfirmed',
    ]);
    expect([...settledIds(outcomes)].toSorted()).toEqual(['alpha', 'beta']);
  });

  it('reports a call whose answer was lost as the refreshed snapshot shows it', async () => {
    // Beta's fit joined its queue after the preflight, before its call. Every slot is busy.
    const current = workspace({
      cards: [lead('alpha'), lead('beta'), lead('gamma')],
      queue: {
        concurrency: 1,
        active: 1,
        background: 0,
        queues: [queue('job:beta', { requests: [fit('beta')] })],
      },
    });
    vi.mocked(api).mockRejectedValue(new TypeError('Failed to fetch'));
    const sent = await sendFits(
      ['alpha', 'beta', 'gamma'],
      () => current,
      () => {},
    );
    expect(Object.fromEntries(sent)).toEqual({
      alpha: { kind: 'unanswered', before: [] },
      beta: { kind: 'unanswered', before: ['fit-beta'] },
      gamma: { kind: 'unanswered', before: [] },
    });
    // The daemon queued alpha before its answer was lost; gamma's request shows nowhere.
    const fresh = workspace({
      ...current,
      queue: {
        ...current.queue!,
        queues: [
          queue('job:beta', { requests: [fit('beta')] }),
          queue('job:alpha', { requests: [request('new-alpha', { boardAction: 'fit' })] }),
        ],
      },
    });
    const plan = { outcomes: new Map(), send: ['alpha', 'beta', 'gamma'] };
    const outcomes = fitOutcomes(fresh, [], plan, sent, ['alpha', 'beta', 'gamma']);
    expect(outcomes.map((outcome) => [outcome.kind, outcome.text])).toEqual([
      ['queued', 'Queued · 2nd in line'],
      ['existing', 'Already queued · 1st in line'],
      ['unconfirmed', 'No answer from Pitchcrew · check this job’s queue before retrying'],
    ]);
    expect(outcomeParts(outcomes)).toEqual([
      '3 jobs',
      '1 queued',
      '1 already queued',
      '0 not sent',
      '1 unconfirmed',
    ]);
    // What the snapshot settled leaves the selection; the unconfirmed job stays for a retry.
    expect([...settledIds(outcomes)].toSorted()).toEqual(['alpha', 'beta']);
    // With every lost answer settled, the counts read as an answered batch's.
    const settled = fitOutcomes(fresh, [], plan, new Map([...sent].slice(0, 2)), ['alpha', 'beta']);
    expect(outcomeParts(settled)).toEqual(['2 jobs', '1 queued', '1 already queued', '0 not sent']);
  });

  it('rereads already queued places from the refreshed snapshot', () => {
    const data = classes();
    const result = plan(data, ['north']);
    const moved = {
      ...data,
      queue: {
        ...data.queue!,
        queues: [queue('job:other', { requests: [fit('other')] }), ...data.queue!.queues],
      },
    };
    expect(fitOutcomes(moved, [], result, new Map(), ['north'])[0]?.text).toBe(
      'Already queued · 2nd in line',
    );
  });
});
