import { describe, expect, it } from 'vitest';
import type { Conversation, Snapshot, WorkQueueView } from '@pitchcrew/core';
import { attentionItems } from '../attention.ts';
import {
  crewLens,
  isLensGroup,
  lensOrder,
  lensSummary,
  stampText,
  type LensEntry,
  type LensGroup,
  type LensRow,
} from '../crew-lens.ts';
import { liveRunIndex } from '../live-runs.ts';
import { sinceLabel, untilLabel } from '../time.ts';
import {
  ago,
  attempt,
  brief,
  browserApproval,
  card,
  delivery,
  everyKind,
  now,
  question,
  queue,
  request,
  roles,
  run,
  snapshot,
  task,
} from './attention-fixture.ts';
import { cast, installed, routine, runtime, waiting } from './crew-lens-fixture.ts';

// Crew's At work lens on fictional snapshots: every entry source, the order inside a row, groups,
// pebbles, idle facts and the row order, in Crew's compact time style.

/** The lens of a snapshot whose agents' runtime is installed unless the test lists runtimes. */
const lens = (data: Snapshot, at = now) => {
  const ready = installed(data);
  return crewLens(ready, attentionItems(ready), liveRunIndex(ready), at);
};
const row = (rows: LensRow[], roleId: string) => rows.find((item) => item.roleId === roleId)!;
const entries = (item: LensRow) =>
  item.items.flatMap((entry) => (isLensGroup(entry) ? entry.entries : [entry]));
const groups = (item: LensRow) => item.items.filter(isLensGroup);
const singles = (item: LensRow) => item.items.filter((entry) => !isLensGroup(entry)) as LensEntry[];

describe('entries', () => {
  it('shows every executing run of an agent at once, with its follow-up and live step', () => {
    const data = cast({
      activityRuns: [
        run('run-acme', {
          cardId: 'acme',
          threadId: 't-acme',
          purpose: 'application-draft',
          startedAt: ago(12),
          activity: [
            {
              id: 'step-1',
              kind: 'tool',
              label: 'Writing the cover letter',
              status: 'running',
              startedAt: ago(1),
              finishedAt: null,
            },
          ],
        }),
      ],
    });
    const writer = row(lens(data), 'writer');
    expect(writer.items.slice(0, 2)).toMatchObject([
      {
        key: 'run:run-acme',
        state: 'running',
        tone: 'plum',
        live: true,
        subject: 'Acme Robotics',
        action: 'Drafting the packet',
        detail: 'Writing the cover letter',
        stamp: { word: 'running', time: '12m' },
        queueId: 'job:acme',
        runId: 'run-acme',
        threadId: 't-acme',
      },
      {
        key: 'run:run-globex',
        subject: 'Globex',
        action: 'Follow-up for Reviewer',
        followUpFor: 'Reviewer',
        stamp: { word: 'running', time: '5m' },
      },
    ]);
    expect(writer.live).toBe(true);
  });

  it('includes a job-free routine run, after the runs in job queues', () => {
    const data = cast({
      runs: [
        ...cast().runs,
        run('run-routine', {
          roleId: 'scout',
          routineId: 'routine-1',
          threadId: 't-routine',
          startedAt: ago(30),
        }),
      ],
      routines: [routine({})],
    });
    const scout = singles(row(lens(data), 'scout')).filter((entry) => entry.state === 'running');
    expect(scout.map((entry) => entry.subject)).toEqual(['Lumen Labs', 'Morning scan']);
    expect(scout[1]).toMatchObject({
      queueId: null,
      action: '',
      stamp: { word: 'running', time: '30m' },
    });
  });

  it('names work without the job its entry already names, as Home and the table do', () => {
    const data = snapshot({
      cards: [card('acme', { company: 'Acme Robotics', state: 'drafting' })],
      runs: [run('run-check', { cardId: 'acme', roleId: 'scout', routineId: 'routine-1' })],
      routines: [routine({ name: 'Acme Robotics: posting check', cardId: 'acme' })],
    });
    expect(singles(row(lens(data), 'scout'))[0]).toMatchObject({
      subject: 'Acme Robotics',
      action: 'posting check',
    });
  });

  it('shows a browser request as the asking agent’s wait, never as working, without its own approval', () => {
    const submitter = row(lens(cast()), 'submitter');
    expect(submitter.items).toEqual([
      expect.objectContaining({
        key: 'browser:approval-1',
        state: 'asks',
        tone: 'ochre',
        live: false,
        // A chat run with no purpose, routine, request or follow-up names no work of its own.
        action: '',
        subject: 'Initech',
        itemKey: 'browser:approval-1',
        runId: 'run-submit',
        stamp: { word: 'waiting', time: '4m' },
        detail:
          'Waiting for your OK: Click “Submit application” on jobs.example.com · holds its work slot',
      }),
    ]);
    expect(submitter.live).toBe(false);
    expect(submitter.pebble).toBe('ochre');
  });

  it('leaves out automatic browser records: their run is working', () => {
    const data = cast({ computerApprovals: [browserApproval('approval-1', { automatic: true })] });
    expect(row(lens(data), 'submitter').items).toMatchObject([
      { key: 'run:run-submit', state: 'running' },
    ]);
  });

  it('shows a request whose launch is under way as starting, so its agent never looks idle', () => {
    const data = snapshot({
      cards: [card('pine', { company: 'Pine' })],
      queue: {
        concurrency: 5,
        active: 1,
        background: 0,
        queues: [
          queue('job:pine', {
            requests: [
              request('fit-pine', {
                boardAction: 'fit',
                deliveries: [delivery('scout', 'running')],
              }),
            ],
          }),
        ],
      },
    });
    expect(row(lens(data), 'scout')).toMatchObject({
      idle: false,
      items: [
        { state: 'queued', subject: 'Pine', detail: 'Starting now', stamp: { word: 'starting' } },
      ],
    });
  });

  it('shows a pending question with its job’s next action, its slot released', () => {
    const asks = singles(row(lens(cast()), 'writer')).filter((entry) => entry.state === 'asks');
    expect(asks).toEqual([
      expect.objectContaining({
        key: 'question:question-1',
        subject: 'Umbra Health',
        action: 'Draft application',
        detail: 'Waiting for your answer · slot released',
        stamp: { word: 'waiting', time: '25m' },
        itemKey: 'question:question-1',
        tone: 'ochre',
      }),
    ]);
  });

  it('never lends a question the words of a later request held behind it', () => {
    // The asking run waits outside its queue's requests and the agent's next request is queued
    // behind the question: that request is a held entry of its own, so the ask names no action.
    const data = snapshot({
      cards: [card('umbra', { company: 'Umbra Health', state: 'drafting' })],
      runs: [run('run-ask', { cardId: 'umbra', status: 'waiting' })],
      userInputs: [question('question-1')],
      queue: {
        concurrency: 5,
        active: 0,
        background: 0,
        queues: [
          queue('job:umbra', {
            state: 'waiting',
            requests: [
              request('shorten', {
                content: 'Also shorten the closing paragraph.',
                deliveries: [delivery('writer', 'queued')],
              }),
            ],
          }),
        ],
      },
    });
    expect(singles(row(lens(data), 'writer'))).toMatchObject([
      {
        state: 'asks',
        subject: 'Umbra Health',
        action: '',
        detail: 'Waiting for your answer · slot released',
      },
      {
        state: 'held',
        subject: 'Umbra Health',
        action: 'Also shorten the closing paragraph.',
        // Its own question: the row is already the agent's, so it never names itself.
        detail: 'Paused until you answer its question · slot released',
        itemKey: 'question:question-1',
      },
    ]);
  });

  it('counts a waiting line in the workspace order, as Up next does', () => {
    const scout = row(lens(cast()), 'scout');
    const [group] = groups(scout);
    expect(group).toMatchObject({
      key: 'group:queued:scout',
      state: 'queued',
      tone: undefined,
      names: 'Northwind, Kestrel AI, Tidepool',
      action: 'Evaluate fit',
      detail: 'All 3 wait for a free work slot, not for Scout',
      stamp: { word: 'queued', time: '1h' },
    });
    expect(group!.entries.map((entry) => [entry.position, entry.detail])).toEqual([
      [1, 'Next in line for a free work slot'],
      [2, '2nd in line for a free work slot'],
      [3, '3rd in line for a free work slot'],
    ]);
  });

  it('says queued work starts as slots free while some are free', () => {
    const data = cast();
    data.queue = { ...data.queue!, concurrency: 6 };
    const [group] = groups(row(lens(data), 'scout'));
    expect(group?.detail).toBe('All 3 start as slots free');
    expect(group?.entries.map((entry) => entry.detail)).toEqual([
      'Starting in a free work slot',
      'Starting in a free work slot',
      'Next in line for a free work slot',
    ]);
  });

  it('places a later request after the work ahead of it in its own job queue', () => {
    const data = snapshot({
      cards: [card('acme', { company: 'Acme Robotics' }), card('quill', { company: 'Quill' })],
      runs: [run('run-acme', { cardId: 'acme', purpose: 'application-draft' })],
      queue: {
        concurrency: 5,
        active: 1,
        background: 0,
        queues: [
          queue('job:acme', {
            state: 'running',
            runs: [run('run-acme', { cardId: 'acme', purpose: 'application-draft' })],
            requests: [
              request('review-acme', {
                boardAction: 'review',
                deliveries: [delivery('reviewer', 'queued')],
              }),
            ],
          }),
          queue('job:quill', {
            requests: [
              request('fit-quill', {
                boardAction: 'fit',
                deliveries: [delivery('scout', 'queued')],
              }),
              request('draft-quill', {
                boardAction: 'draft',
                deliveries: [delivery('writer', 'queued')],
              }),
            ],
          }),
        ],
      },
    });
    const rows = lens(data);
    expect(row(rows, 'reviewer').items).toMatchObject([
      { state: 'queued', subject: 'Acme Robotics', action: 'Review packet' },
    ]);
    expect((row(rows, 'reviewer').items[0] as LensEntry).detail).toBe('After Drafting the packet');
    // Writer also drafts Acme Robotics; its later request on Quill waits behind Scout's fit there.
    expect(row(rows, 'writer').items).toMatchObject([
      { state: 'running', subject: 'Acme Robotics' },
      { state: 'queued', action: 'Draft application', detail: 'After Evaluate fit' },
    ]);
    expect(row(rows, 'scout').items).toMatchObject([
      { state: 'queued', detail: 'Starting in a free work slot', position: undefined },
    ]);
  });

  it('shows a queued crew follow-up with whose it is', () => {
    const parent = run('run-review', { roleId: 'reviewer', status: 'completed' });
    const data = snapshot({
      cards: [card('globex', { company: 'Globex' })],
      runs: [parent],
      tasks: [task('task-1', { parentRunId: 'run-review', cardId: 'globex' })],
      queue: {
        concurrency: 5,
        active: 1,
        background: 0,
        queues: [
          queue('job:globex', {
            tasks: [task('task-1', { parentRunId: 'run-review', cardId: 'globex' })],
          }),
        ],
      },
    });
    expect(row(lens(data), 'writer').items).toMatchObject([
      {
        key: 'task:task-1',
        state: 'queued',
        action: 'Follow-up for Reviewer',
        followUpFor: 'Reviewer',
        detail: 'Runs before the next request in its queue',
        stamp: { word: 'queued', time: '20m' },
      },
    ]);
  });

  it('holds work paused by the user, blocked or behind another agent’s question, with no duration', () => {
    const data = snapshot({
      cards: [
        card('pine', { company: 'Pine' }),
        card('birch', { company: 'Birch' }),
        card('umbra', { company: 'Umbra Health', state: 'drafting' }),
      ],
      userInputs: [question('question-1')],
      queue: {
        concurrency: 5,
        active: 0,
        background: 0,
        queues: [
          waiting('pine', 'reviewer', {
            state: 'paused',
            paused: true,
            pauseKind: 'user',
            reason: 'Paused by you.',
          }),
          waiting('birch', 'reviewer', {
            state: 'blocked',
            reason: 'Install the assigned runtime in Settings.',
          }),
          queue('job:umbra', {
            state: 'waiting',
            requests: [
              request('draft-umbra', { deliveries: [delivery('writer', 'waiting', 'run-ask')] }),
              request('review-umbra', {
                boardAction: 'review',
                deliveries: [delivery('reviewer', 'queued')],
              }),
            ],
          }),
        ],
      },
    });
    const [group] = groups(row(lens(data), 'reviewer'));
    expect(group).toMatchObject({
      state: 'held',
      tone: 'ochre',
      detail: 'All 3 are on hold in their own job queues',
      stamp: { word: 'on hold' },
    });
    expect(group!.entries).toMatchObject([
      { subject: 'Pine', tone: undefined, detail: 'Paused by you', stamp: { word: 'on hold' } },
      {
        subject: 'Birch',
        tone: 'ochre',
        detail: 'Install the assigned runtime in Settings.',
        itemKey: 'blocked:job:birch',
      },
      {
        subject: 'Umbra Health',
        tone: 'ochre',
        detail: 'Paused until you answer Writer’s question · slot released',
        itemKey: 'question:question-1',
      },
    ]);
    expect(group!.entries.every((entry) => stampText(entry.stamp) === 'on hold')).toBe(true);
  });

  it('shows failed work rose with its error and the time it stopped, linked to its Needs you item', () => {
    const data = cast({
      runs: [
        ...cast().runs,
        run('run-corvid', {
          cardId: 'corvid',
          roleId: 'scout',
          status: 'failed',
          finishedAt: ago(50),
        }),
      ],
    });
    data.queue!.queues[5]!.requests[0]!.deliveries[0]!.runId = 'run-corvid';
    const failed = singles(row(lens(data), 'scout')).find((entry) => entry.state === 'failed');
    expect(failed).toMatchObject({
      subject: 'Corvid',
      tone: 'rose',
      action: 'Evaluate fit',
      detail: 'Scout stopped.',
      stamp: { word: 'failed', time: sinceLabel(Date.parse(ago(50)), now) },
      itemKey: 'failure:job:corvid',
    });
  });

  it('says plain "failed" for a request that never ran: when it was queued is not when it failed', () => {
    const failed = singles(row(lens(cast()), 'scout')).find((entry) => entry.state === 'failed');
    expect(failed?.stamp).toEqual({ word: 'failed' });
  });

  it('colours every failed request rose, even in a queue that is not paused as failed', () => {
    // The dev examples leave a failed delivery in a lane that waits on a question instead.
    const data = snapshot({
      cards: [card('waypoint', { company: 'Waypoint', state: 'in_review' })],
      userInputs: [question('question-1', { cardId: 'waypoint', runId: 'run-ask' })],
      runs: [run('run-ask', { cardId: 'waypoint', status: 'waiting' })],
      queue: {
        concurrency: 5,
        active: 0,
        background: 0,
        queues: [
          queue('job:waypoint', {
            state: 'waiting',
            requests: [
              request('check', {
                content: 'Confirm the portfolio link still opens.',
                deliveries: [delivery('reviewer', 'failed')],
              }),
            ],
          }),
        ],
      },
    });
    const reviewer = row(lens(data), 'reviewer');
    expect(reviewer.items).toMatchObject([
      { state: 'failed', tone: 'rose', stamp: { word: 'failed' } },
    ]);
    expect(reviewer.pebble).toBe('rose');
    expect(lensSummary(reviewer)).toEqual([
      { key: 'failed', text: 'Waypoint', stamp: { word: 'failed' }, tone: 'rose' },
    ]);
  });

  it('colours a failed follow-up by its queue: ochre once a restart interrupted it, rose when it failed', () => {
    const lane = (pauseKind: 'failed' | 'interrupted') =>
      snapshot({
        cards: [card('globex', { company: 'Globex' })],
        runs: [
          run('run-review', { roleId: 'reviewer', status: 'completed' }),
          run('run-fix', { cardId: 'globex', status: 'failed', finishedAt: ago(30) }),
        ],
        queue: {
          concurrency: 5,
          active: 0,
          background: 0,
          queues: [
            queue('job:globex', {
              state: 'paused',
              paused: true,
              pauseKind,
              tasks: [
                task('task-1', {
                  parentRunId: 'run-review',
                  cardId: 'globex',
                  status: 'failed',
                  runId: 'run-fix',
                  error: 'Writer stopped before finishing.',
                }),
              ],
            }),
          ],
        },
      });
    expect(row(lens(lane('interrupted')), 'writer').items).toMatchObject([
      {
        state: 'failed',
        tone: 'ochre',
        detail: 'Interrupted when Pitchcrew stopped',
        stamp: { word: 'interrupted' },
        followUpFor: 'Reviewer',
        itemKey: 'failure:job:globex',
      },
    ]);
    expect(row(lens(lane('failed')), 'writer').items).toMatchObject([
      {
        state: 'failed',
        tone: 'rose',
        detail: 'Writer stopped before finishing.',
        stamp: { word: 'failed', time: sinceLabel(Date.parse(ago(30)), now) },
      },
    ]);
    expect(row(lens(lane('interrupted')), 'writer').pebble).toBe('ochre');
  });

  it('shows a request interrupted by a restart as stopped work waiting for Retry or Skip', () => {
    const data = snapshot({
      cards: [card('pine', { company: 'Pine' })],
      queue: {
        concurrency: 5,
        active: 0,
        background: 0,
        queues: [
          queue('job:pine', {
            state: 'paused',
            paused: true,
            pauseKind: 'interrupted',
            requests: [
              request('draft-pine', {
                boardAction: 'draft',
                deliveries: [delivery('writer', 'paused', 'run-gone')],
              }),
            ],
          }),
        ],
      },
    });
    expect(row(lens(data), 'writer').items).toMatchObject([
      {
        state: 'failed',
        tone: 'ochre',
        stamp: { word: 'interrupted' },
        action: 'Draft application',
      },
    ]);
  });
});

describe('lanes that start nothing new while a run in them still executes', () => {
  /** Acme's lane runs Writer's draft, with Reviewer's request queued behind it. */
  const acme = (fields: Partial<WorkQueueView> = {}, extra: Partial<Snapshot> = {}) => {
    const draft = run('run-acme', { cardId: 'acme', purpose: 'application-draft' });
    return snapshot({
      cards: [card('acme', { company: 'Acme Robotics', state: 'drafting' })],
      runs: [draft],
      queue: {
        concurrency: 5,
        active: 1,
        background: 0,
        queues: [
          queue('job:acme', {
            state: 'running',
            runs: [draft],
            requests: [
              request('review-acme', {
                boardAction: 'review',
                deliveries: [delivery('reviewer', 'queued')],
              }),
            ],
            ...fields,
          }),
        ],
      },
      ...extra,
    });
  };
  const reviewerEntry = (data: Snapshot) => row(lens(data), 'reviewer').items[0] as LensEntry;

  it('holds later work in a lane the user paused while its run goes on, as Home says', () => {
    const data = acme({ paused: true, pauseKind: 'user', reason: 'Paused by you.' });
    expect(reviewerEntry(data)).toMatchObject({
      state: 'held',
      tone: undefined,
      detail: 'Paused by you',
      stamp: { word: 'on hold' },
    });
    // The run itself keeps going, and keeps its own queue's menu.
    expect(row(lens(data), 'writer').items).toMatchObject([
      { state: 'running', queue: expect.objectContaining({ id: 'job:acme' }) },
    ]);
  });

  it('holds later work behind a failure that stopped its lane while another run executes', () => {
    const reason = 'Scout’s fit evaluation stopped before finishing. Retry or skip this request.';
    expect(reviewerEntry(acme({ paused: true, pauseKind: 'failed', reason }))).toMatchObject({
      state: 'held',
      tone: 'rose',
      detail: reason,
    });
    expect(
      reviewerEntry(acme({ paused: true, pauseKind: 'interrupted', reason: 'Interrupted.' })),
    ).toMatchObject({ state: 'held', tone: 'ochre', detail: 'Interrupted.' });
  });

  it('holds later work behind a question, without claiming the still busy slot was released', () => {
    const data = acme(
      {},
      {
        userInputs: [question('question-1', { cardId: 'acme', runId: 'run-ask' })],
      },
    );
    expect(reviewerEntry(data)).toMatchObject({
      state: 'held',
      tone: 'ochre',
      detail: 'Paused until you answer Writer’s question',
      itemKey: 'question:question-1',
    });
    expect(singles(row(lens(data), 'writer'))).toMatchObject([
      { state: 'running' },
      { state: 'asks', detail: 'Waiting for your answer' },
    ]);
  });

  it('still places later work after the current run in a lane that can go on', () => {
    expect(reviewerEntry(acme())).toMatchObject({
      state: 'queued',
      detail: 'After Drafting the packet',
    });
  });
});

describe('holds that wait on the user', () => {
  it('makes a queue behind a promoted brief an ask of its agent, linked to the brief, taking no place', () => {
    const data = snapshot({
      cards: [
        card('quill', {
          company: 'Quill Studio',
          state: 'shortlisted',
          applicationContext: brief(),
        }),
        card('pine', { company: 'Pine' }),
      ],
      queue: {
        concurrency: 1,
        active: 1,
        background: 0,
        queues: [
          queue('job:quill', {
            requests: [
              request('draft-quill', {
                boardAction: 'draft',
                deliveries: [delivery('writer', 'queued')],
              }),
            ],
          }),
          waiting('pine'),
        ],
      },
    });
    const rows = lens(data);
    expect(row(rows, 'writer').items).toEqual([
      expect.objectContaining({
        state: 'asks',
        tone: 'ochre',
        subject: 'Quill Studio',
        action: 'Draft application',
        detail: 'Confirm the job brief first',
        itemKey: 'brief:quill',
      }),
    ]);
    // The queue behind the brief takes no place, so Pine is next in line.
    expect(row(rows, 'scout').items).toMatchObject([
      { position: 1, detail: 'Next in line for a free work slot' },
    ]);
  });

  it('makes a queue held for an unverified submission an ask, linked to the verify item', () => {
    const data = snapshot({
      cards: [
        card('fathom', {
          company: 'Fathom',
          state: 'submitted',
          submissionAttempts: [attempt('attempt-1', 'fathom')],
        }),
      ],
      queue: {
        concurrency: 5,
        active: 0,
        background: 0,
        queues: [
          waiting('fathom', 'scout', {
            state: 'blocked',
            reason: 'Verify the previous submission outcome first.',
          }),
        ],
      },
    });
    expect(row(lens(data), 'scout').items).toMatchObject([
      { state: 'asks', detail: 'Verify the submission first', itemKey: 'verify:attempt-1' },
    ]);
  });
});

describe('work its own agent cannot start', () => {
  /** Scout on Codex instead of Demo, in a cast that lists `runtimes`. */
  const onCodex = (fields: Partial<Snapshot>) => {
    const data = cast(fields);
    return {
      ...data,
      roles: data.roles.map((role) =>
        role.id === 'scout' ? { ...role, runtime: 'codex' as const } : role,
      ),
    };
  };

  it('holds a paused agent’s queued work for you, with no place in line for a free work slot', () => {
    const data = cast({
      roles: roles.map((role) => (role.id === 'scout' ? { ...role, enabled: false } : role)),
    });
    const scout = row(lens(data), 'scout');
    // Every slot is busy, but a free one would not start this work: the server holds it instead.
    expect(scout.meta).toBe('Paused · Demo · Scripted');
    expect(groups(scout)).toMatchObject([
      {
        state: 'held',
        tone: 'ochre',
        names: 'Northwind, Kestrel AI, Tidepool',
        detail: 'All 3 start after you resume Scout in Crew',
        stamp: { word: 'on hold' },
      },
    ]);
    expect(groups(scout)[0]!.entries.map((entry) => [entry.detail, entry.position])).toEqual([
      ['Starts after you resume Scout in Crew', undefined],
      ['Starts after you resume Scout in Crew', undefined],
      ['Starts after you resume Scout in Crew', undefined],
    ]);
    expect(entries(scout).filter((entry) => /work slot|not for Scout/.test(entry.detail))).toEqual(
      [],
    );
    // The pebble stays on the agent's own work: its failure, not the hold.
    expect(scout.pebble).toBe('rose');
  });

  it('holds work whose runtime is not installed or waits for sign-in, as the roster says', () => {
    const missing = row(
      lens(onCodex({ runtimes: [runtime('demo'), runtime('codex', false)] })),
      'scout',
    );
    expect(missing.meta).toBe('Runtime unavailable · Codex · CLI default');
    expect(groups(missing)[0]?.detail).toBe('All 3 start once you install Codex in Settings');
    const signedOut = onCodex({
      runtimes: [runtime('demo'), runtime('codex')],
      runtimeMaintenance: {
        enabled: true,
        automatic: false,
        checking: false,
        nextCheckAt: null,
        updates: [],
        authentication: [
          {
            runtime: 'codex',
            model: '',
            result: { status: 'missing', detail: '', checkedAt: ago(2), instructions: '' },
          },
        ],
      },
    });
    const scout = row(lens(signedOut), 'scout');
    expect(scout.meta).toBe('Needs sign-in · Codex · CLI default');
    expect(entries(scout).find((entry) => entry.subject === 'Northwind')?.detail).toBe(
      'Starts once you sign in to Codex in Settings',
    );
    // An agent that can start keeps its place in line.
    expect(
      row(lens(onCodex({ runtimes: [runtime('demo'), runtime('codex')] })), 'scout').meta,
    ).toBe('Codex · CLI default');
  });

  it('holds every agent of a request one of them cannot start, as the server holds it whole', () => {
    const group = queue('conversation:t-group', {
      threadId: 't-group',
      requests: [
        request('both', {
          threadId: 't-group',
          content: 'Compare notes on the portfolio',
          deliveries: [delivery('writer', 'queued'), delivery('reviewer', 'queued')],
        }),
      ],
    });
    const data = snapshot({
      roles: roles.map((role) => (role.id === 'reviewer' ? { ...role, enabled: false } : role)),
      conversations: [{ id: 't-group', title: 'Portfolio' } as unknown as Conversation],
      queue: { concurrency: 1, active: 1, background: 0, queues: [group] },
    });
    const rows = lens(data);
    for (const roleId of ['writer', 'reviewer'])
      expect(entries(row(rows, roleId))).toMatchObject([
        { state: 'held', tone: 'ochre', detail: 'Starts after you resume Reviewer in Crew' },
      ]);
  });

  it('reads a conversation’s own runtime for its requests, and the agent’s for board actions', () => {
    // Writer runs on Demo, but this conversation chose Codex for it, which is not installed.
    const ask = request('ask-pine', {
      threadId: 't-pine',
      content: 'Tighten the summary',
      deliveries: [delivery('writer', 'queued')],
    });
    const data = (head: typeof ask) =>
      snapshot({
        runtimes: [runtime('demo'), runtime('codex', false)],
        cards: [card('pine', { company: 'Pine' })],
        conversations: [
          {
            id: 't-pine',
            configurations: { writer: { runtime: 'codex' } },
          } as unknown as Conversation,
        ],
        queue: {
          concurrency: 1,
          active: 1,
          background: 0,
          queues: [queue('job:pine', { threadId: 't-pine', requests: [head] })],
        },
      });
    expect(entries(row(lens(data(ask)), 'writer'))).toMatchObject([
      { state: 'held', tone: 'ochre', detail: 'Starts once you install Codex in Settings' },
    ]);
    expect(entries(row(lens(data({ ...ask, boardAction: 'draft' })), 'writer'))).toMatchObject([
      { state: 'queued', detail: 'Next in line for a free work slot', position: 1 },
    ]);
  });
});

describe('rows', () => {
  it('orders a row running, asks, queued, held, failed', () => {
    const data = cast({
      userInputs: [question('question-1', { roleId: 'scout' })],
    });
    data.queue!.queues.push(
      waiting('pine', 'scout', { state: 'paused', paused: true, pauseKind: 'user' }),
    );
    data.cards.push(card('pine', { company: 'Pine' }));
    const scout = row(lens(data), 'scout');
    expect(scout.items.map((item) => item.state)).toEqual([
      'running',
      'asks',
      'queued',
      'held',
      'failed',
    ]);
  });

  it('groups queued and failed work from two, asks and holds from three, and says "Both"', () => {
    const two = cast();
    two.queue!.queues.pop();
    const [queued] = groups(row(lens(two), 'scout'));
    expect(queued?.detail).toBe('Both wait for a free work slot, not for Scout');
    const failing = (id: string) =>
      queue(`job:${id}`, {
        state: 'paused',
        paused: true,
        pauseKind: 'failed',
        requests: [request(`fit-${id}`, { deliveries: [delivery('scout', 'failed')] })],
      });
    const failed = snapshot({
      cards: [card('pine', { company: 'Pine' }), card('birch', { company: 'Birch' })],
      queue: {
        concurrency: 5,
        active: 0,
        background: 0,
        queues: [failing('pine'), failing('birch')],
      },
    });
    expect(row(lens(failed), 'scout').items).toEqual([
      expect.objectContaining({
        state: 'failed',
        tone: 'rose',
        names: 'Pine, Birch',
        detail: 'Both stopped before finishing; their job queues are paused',
      }),
    ]);
    const held = snapshot({
      cards: [card('pine', { company: 'Pine' }), card('birch', { company: 'Birch' })],
      queue: {
        concurrency: 5,
        active: 0,
        background: 0,
        queues: ['pine', 'birch'].map((id) =>
          waiting(id, 'scout', { state: 'paused', paused: true, pauseKind: 'user' }),
        ),
      },
    });
    expect(row(lens(held), 'scout').items.map(isLensGroup)).toEqual([false, false]);
  });

  it('says "not for {Agent}" only while every slot is busy, even when a group mixes its waits', () => {
    // Pine waits at the head of its queue; Quill's fit waits behind Writer's draft in its own.
    const mixed = (active: number) =>
      snapshot({
        cards: [card('pine', { company: 'Pine' }), card('quill', { company: 'Quill' })],
        queue: {
          concurrency: 5,
          active,
          background: 0,
          queues: [
            waiting('pine'),
            queue('job:quill', {
              requests: [
                request('draft-quill', {
                  boardAction: 'draft',
                  deliveries: [delivery('writer', 'queued')],
                }),
                request('fit-quill', {
                  boardAction: 'fit',
                  deliveries: [delivery('scout', 'queued')],
                }),
              ],
            }),
          ],
        },
      });
    const [free] = groups(row(lens(mixed(0)), 'scout'));
    expect(free?.detail).toBe('Both wait in their own job queues');
    expect(free?.entries.map((entry) => entry.detail)).toEqual([
      'Starting in a free work slot',
      'After Draft application',
    ]);
    expect(groups(row(lens(mixed(5)), 'scout'))[0]?.detail).toBe(
      'Both wait in their own job queues, not for Scout',
    );
  });

  it('never counts a launch under way as a wait for a free work slot', () => {
    const launching = (id: string) =>
      queue(`job:${id}`, {
        requests: [
          request(`fit-${id}`, { boardAction: 'fit', deliveries: [delivery('scout', 'running')] }),
        ],
      });
    const data = (queues: WorkQueueView[]) =>
      snapshot({
        cards: ['pine', 'birch'].map((id) => card(id, { company: id })),
        queue: { concurrency: 5, active: 5, background: 0, queues },
      });
    const [mixed] = groups(row(lens(data([launching('pine'), waiting('birch')])), 'scout'));
    expect(mixed?.detail).toBe('Both wait in their own job queues, not for Scout');
    expect(mixed?.entries[0]).toMatchObject({
      detail: 'Starting now',
      stamp: { word: 'starting' },
    });
    const [both] = groups(row(lens(data([launching('pine'), launching('birch')])), 'scout'));
    expect(both?.detail).toBe('Both are starting');
  });

  it('holds a later request behind a failure in rose, and the pebble shows that failure', () => {
    const data = cast();
    data.queue!.queues[5]!.requests.push(
      request('salary-corvid', {
        content: 'Check the salary band',
        deliveries: [delivery('scout', 'queued')],
      }),
    );
    const scout = row(lens(data), 'scout');
    expect(singles(scout).find((entry) => entry.state === 'held')).toMatchObject({
      subject: 'Corvid',
      tone: 'rose',
      detail: 'Scout’s fit evaluation stopped before finishing. Retry or skip this request.',
      itemKey: 'failure:job:corvid',
    });
    expect(scout.pebble).toBe('rose');
  });

  it('keeps the pebble on the agent’s own state: a hold behind another agent’s question is not its ask', () => {
    const data = cast();
    const seat = run('run-halcyon', {
      cardId: 'halcyon',
      roleId: 'reviewer',
      purpose: 'application-review',
    });
    data.cards.push(card('halcyon', { company: 'Halcyon', state: 'in_review' }));
    data.runs.push(seat);
    data.queue!.queues.push(queue('job:halcyon', { state: 'running', runs: [seat] }));
    data.queue!.queues[4]!.requests.push(
      request('review-umbra', {
        boardAction: 'review',
        deliveries: [delivery('reviewer', 'queued')],
      }),
    );
    const reviewer = row(lens(data), 'reviewer');
    expect(reviewer.items).toMatchObject([
      { state: 'running', subject: 'Halcyon' },
      {
        state: 'held',
        tone: 'ochre',
        detail: 'Paused until you answer Writer’s question · slot released',
      },
    ]);
    expect(reviewer.pebble).toBe('plum');
  });

  it('names three jobs and counts the rest', () => {
    const data = cast();
    for (const id of ['pine', 'birch', 'cedar']) {
      data.cards.push(card(id, { company: id[0]!.toUpperCase() + id.slice(1) }));
      data.queue!.queues.push(waiting(id));
    }
    const [group] = groups(row(lens(data), 'scout')) as LensGroup[];
    expect(group?.names).toBe('Northwind, Kestrel AI, Tidepool and 3 more');
    expect(group?.entries).toHaveLength(6);
  });

  it('never makes a proposal, update or other change an entry; CrewWaiting lists those', () => {
    const rows = [...lens(everyKind()), ...lens(cast())];
    const keys = rows.flatMap((item) => entries(item).map((entry) => entry.itemKey ?? ''));
    expect(
      keys.filter((key) =>
        /^(role-proposal|skill-proposal|instruction-update|skill-update|writing-suggestion|profile-proposal|tracking|packet|export|connection|profile-recovery):/.test(
          key,
        ),
      ),
    ).toEqual([]);
    const writer = row(lens(everyKind()), 'writer');
    expect(entries(writer).map((entry) => entry.itemKey)).toEqual([
      'question:question-1',
      'blocked:conversation:t-prep',
    ]);
  });

  it('gives the pebble ochre for a wait, else rose for a failure, else plum while running', () => {
    const rows = lens(cast());
    expect(row(rows, 'writer').pebble).toBe('ochre');
    expect(row(rows, 'scout').pebble).toBe('rose');
    const calm = cast({ queue: { ...cast().queue!, queues: cast().queue!.queues.slice(0, 4) } });
    expect(row(lens(calm), 'scout').pebble).toBe('plum');
    expect(row(rows, 'tracker').pebble).toBeUndefined();
  });

  it('shows a review seat reservation only in its agent’s idle fact', () => {
    const data = snapshot({
      cards: [card('halcyon', { company: 'Halcyon' })],
      runs: [run('seat', { cardId: 'halcyon', reviewSeatReservation: true })],
    });
    const writer = row(lens(data), 'writer');
    expect(writer).toMatchObject({
      idle: true,
      items: [],
      live: false,
      idleFact: 'Reserved for Halcyon’s deep review',
    });
  });

  it('gives idle agents the last job, the next routine and a pause', () => {
    const data = snapshot({
      cards: [card('acme', { company: 'Acme Robotics' })],
      runs: [
        run('done', { cardId: 'acme', status: 'completed', finishedAt: ago(130) }),
        run('older', { cardId: 'acme', status: 'completed', finishedAt: ago(400) }),
      ],
      routines: [
        routine({}),
        routine({ id: 'later', name: 'Weekly review', nextRunAt: ago(-900) }),
      ],
      roles: roles.map((role) => (role.id === 'reviewer' ? { ...role, enabled: false } : role)),
    });
    const rows = lens(data);
    expect(row(rows, 'writer').idleFact).toBe('Last worked on Acme Robotics 2h ago');
    expect(row(rows, 'scout').idleFact).toBe(
      `Next Morning scan ${untilLabel(Date.parse(ago(-120)), now)}`,
    );
    // The pause leads the row's meta, as on a busy row, so the fact says what else is true.
    expect(row(rows, 'reviewer')).toMatchObject({
      meta: 'Paused · Demo · Scripted',
      idleFact: 'Nothing running or queued',
    });
    expect(row(rows, 'tracker').idleFact).toBe('Nothing running or queued');
  });

  it('orders busy agents by their most urgent ask, then by running work, then roster order', () => {
    const rows = lens(cast());
    // Submitter's browser request ranks first, then Corvid's failure (Scout), then the question.
    expect(lensOrder(rows)).toEqual(['submitter', 'scout', 'writer']);
    expect(rows.map((item) => item.roleId)).toEqual([
      'scout',
      'writer',
      'reviewer',
      'submitter',
      'tracker',
      'pipeline-coach',
    ]);
    expect(row(rows, 'reviewer').urgency).toBe(Infinity);
  });

  it('says a folded row in one line: live work with stamps, one wait or failure by name, counts', () => {
    const rows = lens(cast());
    expect(lensSummary(row(rows, 'writer'))).toEqual([
      { key: 'run:run-acme', text: 'Acme Robotics', stamp: { word: 'running', time: '12m' } },
      { key: 'run:run-globex', text: 'Globex', stamp: { word: 'running', time: '5m' } },
      // Only the state word takes the ask's ochre; its time stays quiet.
      {
        key: 'question:question-1',
        text: 'Umbra Health',
        stamp: { word: 'waiting', time: '25m' },
        tone: 'ochre',
      },
    ]);
    expect(lensSummary(row(rows, 'scout'))).toEqual([
      { key: 'run:run-lumen', text: 'Lumen Labs', stamp: { word: 'running', time: '9m' } },
      { key: 'queued', text: '3', stamp: { word: 'queued' } },
      { key: 'failed', text: 'Corvid', stamp: { word: 'failed' }, tone: 'rose' },
    ]);
  });
});

describe('stamps', () => {
  it('use Crew’s compact style', () => {
    const data = cast();
    data.runs[0] = { ...data.runs[0]!, startedAt: ago(65) };
    data.queue!.queues[0]!.runs[0] = data.runs[0]!;
    const at = (minutes: number) => now + minutes * 60_000;
    const said = (rows: LensRow[], roleId: string) =>
      stampText((row(rows, roleId).items[0] as LensEntry).stamp);
    expect(said(lens(data), 'writer')).toBe('running 1h 5m');
    expect(said(lens(cast(), at(12 * 60)), 'submitter')).toBe('waiting 12h');
    const fresh = cast({
      computerApprovals: [browserApproval('approval-1', { createdAt: ago(0) })],
    });
    expect((row(lens(fresh), 'submitter').items[0] as LensEntry).stamp).toEqual({
      word: 'asked',
      time: 'just now',
    });
  });

  it('give a group of different ages its state word and the oldest time, never "oldest" alone', () => {
    const failing = (id: string, ran?: number) =>
      queue(`job:${id}`, {
        state: 'paused',
        paused: true,
        pauseKind: 'failed',
        requests: [
          request(`fit-${id}`, {
            boardAction: 'fit',
            deliveries: [delivery('scout', 'failed', ran === undefined ? null : `run-${id}`)],
          }),
        ],
      });
    const failed = (ran: (number | undefined)[]) =>
      snapshot({
        cards: ['pine', 'birch'].map((id) => card(id, { company: id })),
        runs: ['pine', 'birch'].flatMap((id, index) =>
          ran[index] === undefined
            ? []
            : [
                run(`run-${id}`, {
                  cardId: id,
                  roleId: 'scout',
                  status: 'failed',
                  finishedAt: ago(ran[index]!),
                }),
              ],
        ),
        queue: {
          concurrency: 5,
          active: 0,
          background: 0,
          queues: [failing('pine', ran[0]), failing('birch', ran[1])],
        },
      });
    const [mixed] = groups(row(lens(failed([30, 200])), 'scout'));
    expect(mixed).toMatchObject({ state: 'failed', tone: 'rose' });
    expect(mixed?.stamp).toEqual({
      lead: 'oldest',
      word: 'failed',
      time: sinceLabel(Date.parse(ago(200)), now),
    });
    expect(stampText(mixed!.stamp)).toBe(`oldest failed ${sinceLabel(Date.parse(ago(200)), now)}`);
    // One failure that never ran has no known time, so neither has the group.
    expect(groups(row(lens(failed([30, undefined])), 'scout'))[0]?.stamp).toEqual({
      word: 'failed',
    });

    const asks = snapshot({
      cards: ['pine', 'birch', 'cedar'].map((id) => card(id, { company: id })),
      userInputs: [5, 20, 45].map((minutes, index) =>
        question(`question-${index}`, {
          cardId: ['pine', 'birch', 'cedar'][index]!,
          threadId: `t-${index}`,
          createdAt: ago(minutes),
        }),
      ),
    });
    const [waits] = groups(row(lens(asks), 'writer'));
    expect(waits).toMatchObject({ state: 'asks', tone: 'ochre' });
    expect(waits?.stamp).toEqual({ lead: 'oldest', word: 'waiting', time: '45m' });
  });
});
