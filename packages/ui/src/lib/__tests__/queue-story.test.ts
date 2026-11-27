import { describe, expect, it, vi } from 'vitest';
import type { Snapshot } from '@pitchcrew/core';
import { jobSignals } from '@/ClayInterface/signals.ts';
import { attentionItems } from '../attention.ts';
import { liveRunIndex } from '../live-runs.ts';
import { queueStories } from '../queue-story.ts';
import { clockLabel } from '../time.ts';
import {
  ago,
  brief,
  browserApproval,
  card,
  delivery,
  everyKind,
  now,
  queue,
  request,
  roles,
  run,
  signal,
  snapshot,
  task,
} from './attention-fixture.ts';
import { busySnapshot } from './busy-fixture.ts';
import { installed, runtime } from './crew-lens-fixture.ts';

vi.mock('@/ClayInterface/signals.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/ClayInterface/signals.ts')>();
  return { ...original, jobSignals: vi.fn(original.jobSignals) };
});

/** Every job's story, with the fixture agents' runtime installed unless the test lists runtimes. */
const stories = (snapshotData: Snapshot) => {
  const data = installed(snapshotData);
  return queueStories(data, attentionItems(data), liveRunIndex(data), now);
};
const story = (data: Snapshot, id: string) => stories(data).get(id);

/** A job lead with an extracted brief whose fit waits in its job queue. */
const waitingFit = (id: string, order: number) => ({
  card: card(id, { company: id, applicationContext: brief() }),
  queue: queue(`job:${id}`, {
    order,
    requests: [
      request(`fit-${id}`, {
        boardAction: 'fit',
        content: 'Evaluate fit',
        deliveries: [delivery('scout', 'queued')],
      }),
    ],
  }),
});

describe('queue stories', () => {
  it('lets the job’s highest-ranked item speak first, named for what it opens', () => {
    const live = run('run-submit', {
      cardId: 'initech',
      roleId: 'submitter',
      threadId: 't-initech',
      startedAt: ago(18),
    });
    const data = snapshot({
      cards: [card('initech', { company: 'Initech', state: 'awaiting_approval' })],
      runs: [live],
      computerApprovals: [browserApproval('approval-1')],
      queue: {
        concurrency: 5,
        active: 1,
        background: 0,
        queues: [queue('job:initech', { state: 'running', runs: [live] })],
      },
    });
    const ends = new Date(Date.parse(ago(18)) + 30 * 60_000).toISOString();
    expect(story(data, 'initech')).toEqual({
      kind: 'asks',
      tone: 'ochre',
      live: false,
      agent: 'Submitter',
      text: 'waiting for your OK',
      meta: `ends about ${clockLabel(ends)}`,
      itemKey: 'browser:approval-1',
      control: {
        label: 'Submission',
        name: 'Submission: open Initech’s browser action approval on Home',
      },
    });
  });

  it('words failures in rose, briefs without an agent and tracking by the proposed status', () => {
    const data = snapshot({
      cards: [
        card('corvid', { company: 'Corvid', applicationContext: brief() }),
        card('quill', {
          company: 'Quill Studio',
          state: 'shortlisted',
          applicationContext: brief(),
        }),
        card('bluefin', { company: 'Bluefin', state: 'submitted' }),
      ],
      runs: [
        run('run-corvid', {
          cardId: 'corvid',
          roleId: 'scout',
          status: 'failed',
          startedAt: ago(60),
          finishedAt: ago(50),
          purpose: 'fit',
        }),
      ],
      trackingSignals: [signal('signal-1')],
      queue: {
        concurrency: 5,
        active: 0,
        background: 0,
        queues: [
          queue('job:corvid', {
            state: 'paused',
            paused: true,
            pauseKind: 'failed',
            requests: [
              request('fit-corvid', {
                boardAction: 'fit',
                deliveries: [delivery('scout', 'failed', 'run-corvid')],
              }),
            ],
          }),
        ],
      },
    });
    expect(story(data, 'corvid')).toMatchObject({
      tone: 'rose',
      agent: 'Scout',
      text: 'failed',
      meta: '50m',
      control: { label: 'Failure', name: 'Failure: open Corvid’s failed request on Home' },
    });
    expect(story(data, 'quill')).toMatchObject({
      tone: 'ochre',
      agent: null,
      text: 'Confirm the job brief first',
      control: { label: 'Brief' },
    });
    expect(story(data, 'bluefin')).toMatchObject({
      agent: 'Tracker',
      text: 'proposes Screening',
      control: { label: 'Screening', name: 'Screening: open Bluefin’s tracking review on Home' },
    });
  });

  it('starts every control’s name with its visible word, so speech input finds it', () => {
    const controls = [busySnapshot(), everyKind()].flatMap((data) =>
      [...stories(data).values()].flatMap((entry) => (entry.control ? [entry.control] : [])),
    );
    expect(controls.length).toBeGreaterThan(10);
    for (const control of controls) expect(control.name.startsWith(control.label)).toBe(true);
    // A packet names where it stands as a noun, never a bare stage phrase.
    expect(controls.map((control) => control.name).join('\n')).not.toMatch(/’s (choose|ready)/);
  });

  it('tells a running job’s agent, work and compact duration, and links its run', () => {
    const drafting = run('run-acme', {
      cardId: 'acme',
      threadId: 't-acme',
      purpose: 'application-draft',
      startedAt: ago(65),
    });
    const data = snapshot({
      cards: [card('acme', { company: 'Acme Robotics', state: 'drafting' })],
      runs: [drafting],
    });
    expect(story(data, 'acme')).toEqual({
      kind: 'running',
      tone: 'plum',
      live: true,
      agent: 'Writer',
      text: 'Drafting the packet',
      meta: '1h 5m',
      link: { to: '/chat/$thread', thread: 't-acme', run: 'run-acme' },
      control: { label: 'View', name: 'View Writer’s run on Acme Robotics' },
    });
    const second = run('run-acme-2', { cardId: 'acme', roleId: 'reviewer', startedAt: ago(2) });
    expect(story({ ...data, runs: [drafting, second] }, 'acme')?.agent).toBe('Writer + 1');
    // A chat run in the job's conversation names its work without the company the row names.
    const chat = run('run-acme-chat', { cardId: 'acme', threadId: 't-acme', startedAt: ago(3) });
    const conversations = [{ id: 't-acme', title: 'Acme Robotics: Application work' }] as never;
    expect(story({ ...data, runs: [chat], conversations }, 'acme')?.text).toBe('Application work');
  });

  it('names a crew follow-up once and never treats a review-seat reservation as working', () => {
    const parent = run('run-review', {
      cardId: 'globex',
      roleId: 'reviewer',
      status: 'completed',
      finishedAt: ago(6),
    });
    const child = run('run-fix', { cardId: 'globex', taskId: 'task-1', threadId: 't-globex' });
    const reservation = run('run-seat', {
      cardId: 'halyard',
      roleId: 'reviewer',
      reviewSeatReservation: true,
    });
    const data = snapshot({
      cards: [
        card('globex', { company: 'Globex', state: 'changes_requested' }),
        card('halyard', { company: 'Halyard', state: 'shortlisted' }),
      ],
      runs: [parent, child, reservation],
      tasks: [task('task-1', { parentRunId: 'run-review', runId: 'run-fix', status: 'running' })],
      queue: {
        concurrency: 5,
        active: 2,
        background: 0,
        queues: [queue('job:halyard', { state: 'running', runs: [reservation] })],
      },
    });
    expect(story(data, 'globex')).toMatchObject({
      agent: 'Writer',
      text: 'Follow-up for Reviewer',
    });
    expect(story(data, 'halyard')).toMatchObject({
      kind: 'reserved',
      tone: undefined,
      live: false,
      agent: 'Reviewer',
      text: 'slot reserved for the deep review',
    });
  });

  it('starts the first free slots’ worth, counts the rest in line across conversations and skips a promoted brief', () => {
    const north = waitingFit('northwind', 10);
    const kestrel = waitingFit('kestrel', 11);
    const tide = waitingFit('tidepool', 13);
    const chat = queue('conversation:t-prep', {
      threadId: 't-prep',
      order: 12,
      requests: [
        request('prep', {
          content: 'Prepare questions',
          deliveries: [delivery('writer', 'queued')],
        }),
      ],
    });
    const quill = {
      card: card('quill', {
        company: 'Quill Studio',
        state: 'shortlisted',
        applicationContext: brief(),
      }),
      queue: queue('job:quill', {
        order: 9,
        requests: [
          request('draft-quill', {
            boardAction: 'draft',
            deliveries: [delivery('writer', 'queued')],
          }),
        ],
      }),
    };
    const data = (active: number) =>
      snapshot({
        cards: [north.card, kestrel.card, tide.card, quill.card],
        queue: {
          concurrency: 5,
          active,
          background: 0,
          queues: [quill.queue, north.queue, kestrel.queue, chat, tide.queue],
        },
      });
    const full = stories(data(5));
    // The brief holding Quill's draft is the item; its queue takes no place in line.
    expect(full.get('quill')).toMatchObject({ kind: 'asks', itemKey: 'brief:quill' });
    expect(full.get('northwind')).toMatchObject({
      kind: 'waiting',
      tone: undefined,
      agent: 'Scout',
      text: 'waiting for a slot',
      meta: '1st',
    });
    expect(full.get('kestrel')?.meta).toBe('2nd');
    // The standalone conversation shares the line, so Tidepool is fourth.
    expect(full.get('tidepool')?.meta).toBe('4th');
    const free = stories(data(4));
    expect(free.get('northwind')).toMatchObject({
      agent: 'Scout',
      text: 'Evaluate fit',
      meta: 'starting',
    });
    expect(free.get('kestrel')?.meta).toBe('1st');
    expect(free.get('tidepool')?.meta).toBe('3rd');
    // The Waiting group sorts by the line, starting queues first.
    expect([free.get('northwind')?.line, free.get('kestrel')?.line]).toEqual([1, 2]);
  });

  it('says when an agent is starting before its run exists, and when a job is paused by you', () => {
    const data = snapshot({
      cards: [
        card('acme', { company: 'Acme Robotics', state: 'shortlisted' }),
        card('lumen', { company: 'Lumen Labs', applicationContext: brief() }),
      ],
      queue: {
        concurrency: 5,
        active: 1,
        background: 0,
        queues: [
          queue('job:acme', {
            requests: [
              request('draft-acme', {
                boardAction: 'draft',
                deliveries: [delivery('writer', 'running')],
              }),
            ],
          }),
          queue('job:lumen', {
            state: 'paused',
            paused: true,
            pauseKind: 'user',
            reason: 'Paused by you.',
            requests: [
              request('fit-lumen', {
                boardAction: 'fit',
                deliveries: [delivery('scout', 'queued')],
              }),
            ],
          }),
        ],
      },
    });
    expect(story(data, 'acme')).toMatchObject({ kind: 'starting', text: 'Starting Writer…' });
    expect(story(data, 'lumen')).toMatchObject({
      kind: 'held',
      tone: undefined,
      agent: 'Scout',
      text: 'paused by you',
    });
  });

  it('never puts work its agent cannot start in line for a slot: it waits on you', () => {
    const north = waitingFit('northwind', 10);
    const kestrel = waitingFit('kestrel', 11);
    const data = (fields: Partial<Snapshot>) =>
      snapshot({
        cards: [north.card, kestrel.card],
        queue: { concurrency: 5, active: 5, background: 0, queues: [north.queue, kestrel.queue] },
        ...fields,
      });
    const paused = stories(
      data({
        roles: roles.map((role) => (role.id === 'scout' ? { ...role, enabled: false } : role)),
      }),
    );
    expect(paused.get('northwind')).toMatchObject({
      kind: 'held',
      tone: 'ochre',
      agent: 'Scout',
      text: 'paused',
      meta: '',
    });
    expect(paused.get('northwind')?.line).toBeUndefined();
    const missing = stories(data({ runtimes: [runtime('demo', false)] }));
    expect(missing.get('kestrel')).toMatchObject({ kind: 'held', text: 'runtime unavailable' });
    const unisolated = stories(
      data({ runtimes: [{ ...runtime('demo'), applicationIsolation: false }] }),
    );
    expect(unisolated.get('kestrel')).toMatchObject({
      kind: 'held',
      text: 'needs an isolated runtime',
    });
  });

  it('gives an idle job its next step and never says it waits on you', () => {
    const data = snapshot({
      cards: [
        card('north', { company: 'Northwind', applicationContext: brief() }),
        card('quiet', { company: 'Quiet Co' }),
        card('scored', { company: 'Scored Co', fit: 82, applicationContext: brief() }),
        card('gone', { company: 'Gone Co', state: 'rejected' }),
      ],
    });
    const all = stories(data);
    expect(all.get('north')).toEqual({
      kind: 'idle',
      tone: undefined,
      live: false,
      agent: null,
      text: 'Next: Scout checks the fit',
      meta: '',
    });
    expect(all.get('quiet')?.text).toBe('Next: you prepare the job brief');
    expect(all.get('scored')?.text).toBe('Next: you decide whether to shortlist');
    expect(all.get('gone')?.text).toBe('');
    for (const entry of all.values()) expect(entry.text).not.toMatch(/waiting on you/i);
  });

  it('builds 150 rows without building job signals once', () => {
    vi.mocked(jobSignals).mockClear();
    const data = busySnapshot();
    const all = stories(data);
    expect(all.size).toBe(150);
    expect(vi.mocked(jobSignals)).not.toHaveBeenCalled();
    // The busy morning's asks lead their rows; queued fits wait behind the five busy slots.
    expect(all.get('initech')?.kind).toBe('asks');
    expect(all.get('amber-labs')).toMatchObject({ kind: 'waiting', meta: '1st' });
  });
});
