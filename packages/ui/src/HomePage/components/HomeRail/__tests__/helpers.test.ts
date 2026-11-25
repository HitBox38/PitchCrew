import { describe, expect, it } from 'vitest';
import type { Snapshot, WorkQueueView } from '@pitchcrew/core';
import { attentionItems } from '@/lib/attention.ts';
import {
  ago,
  brief,
  browserApproval,
  card,
  delivery,
  now,
  queue,
  request,
  run,
  snapshot,
  task,
} from '@/lib/__tests__/attention-fixture.ts';
import { installed } from '@/lib/__tests__/crew-lens-fixture.ts';
import { readyLine } from '@/lib/ready-line.ts';
import {
  idleLine,
  linePlaces,
  railModel,
  restNames,
  runTiming,
  slotNotes,
  slotsInUse,
  upNextSegments,
} from '../helpers.ts';
import type { UpNextRow } from '../types.ts';

/** The rail of a snapshot whose agents' runtime is installed, so their queued work can start. */
const model = (data: Snapshot) => {
  const ready = installed(data);
  return railModel(ready, attentionItems(ready));
};

/** A job queue waiting for a slot, whose next request queues `action` for `roleId`. */
const waiting = (company: string, action: 'fit' | 'draft' = 'fit', roleId = 'scout') =>
  queue(`job:${company}`, {
    state: 'ready',
    requests: [
      request(`${action}-${company}`, {
        boardAction: action,
        deliveries: [delivery(roleId, 'queued')],
      }),
    ],
  });
const lineOf = (count: number, free = 0) =>
  linePlaces(
    Array.from({ length: count }, (_, index) => ({
      id: `job:q${index + 1}`,
      cardId: `q${index + 1}`,
      threadId: `t-${index + 1}`,
      subject: `Q${index + 1}`,
      action: 'Evaluate fit',
      roleId: 'scout',
      agent: 'Scout',
      place: index + 1,
      holdsSlot: false,
      phrase: '',
      itemKey: null,
    })),
    free,
  );

describe('Working now', () => {
  const halcyon = run('run-halcyon', {
    cardId: 'halcyon',
    roleId: 'reviewer',
    purpose: 'application-review',
    message: 'Checking 14 claims',
    startedAt: ago(20),
  });
  // A chat run in the job's own conversation: its action falls back to that conversation's title.
  const initech = run('run-submit', {
    cardId: 'initech',
    roleId: 'submitter',
    threadId: 't-initech',
    message: 'Preparing the form',
    startedAt: ago(18),
  });
  const seat = run('seat', { cardId: 'acme', roleId: 'reviewer', reviewSeatReservation: true });
  const data = snapshot({
    cards: [
      card('halcyon', { company: 'Halcyon', state: 'in_review' }),
      card('initech', { company: 'Initech', state: 'awaiting_approval' }),
      card('acme', { company: 'Acme Robotics', state: 'in_review' }),
    ],
    runs: [halcyon, initech, seat],
    conversations: [{ id: 't-initech', title: 'Initech: Application work' }] as never,
    computerApprovals: [browserApproval('approval-1')],
    queue: {
      concurrency: 5,
      active: 3,
      background: 0,
      queues: [
        queue('job:initech', { state: 'running', runs: [initech] }),
        queue('job:halcyon', { state: 'running', runs: [halcyon] }),
        queue('job:acme', { state: 'running', runs: [seat] }),
      ],
    },
  });

  it('lists executing runs in the order their slots were taken, never a reservation', () => {
    const rail = model(data);
    expect(rail.working.map((entry) => [entry.subject, entry.action, entry.agent])).toEqual([
      ['Halcyon', 'Reviewing the packet', 'Reviewer'],
      ['Initech', 'Application work', 'Submitter'],
    ]);
    expect(rail.working[0]).toMatchObject({ activity: 'Checking 14 claims', waitingSince: null });
  });

  it('says a run waits on its browser approval and leads to that Needs you row', () => {
    expect(model(data).working[1]).toMatchObject({
      activity: 'Waiting for your OK',
      waitingSince: ago(4),
      itemKey: 'browser:approval-1',
    });
    expect(runTiming(model(data).working[1]!, now).time).toBe('waiting 4 min');
    expect(runTiming(model(data).working[0]!, now).time).toBe('20 min');
  });

  it('explains a slot held only by a deep review reservation', () => {
    const rail = model(data);
    expect(rail.reserved).toEqual(['Reserved for Acme Robotics’s deep review']);
    expect(slotNotes(rail)).toEqual(['Reserved for Acme Robotics’s deep review']);
    expect(slotsInUse(rail.slots!)).toBe('3 of 5 work slots in use');
  });

  it('counts slots taken beyond the running queues and routines as starting', () => {
    const rail = model({ ...data, queue: { ...data.queue!, active: 5, background: 1 } });
    expect(rail.slots).toMatchObject({ starting: 1, background: 1 });
    expect(slotNotes(rail).slice(1)).toEqual([
      '1 background routine running outside these queues',
      '1 starting',
    ]);
  });

  it('names a run answering what an answer queued by its work, never by the agent’s prompt', () => {
    const answering = run('run-umbra', {
      cardId: 'umbra',
      requestId: 'continue',
      threadId: 't-umbra',
      startedAt: ago(2),
    });
    const rail = model(
      snapshot({
        cards: [card('umbra', { company: 'Umbra Health', state: 'drafting' })],
        runs: [answering],
        chatRequests: [
          request('continue', {
            userInputId: 'question-1',
            content: 'Continue your interrupted task after the user answered your question.',
            deliveries: [delivery('writer', 'running', 'run-umbra')],
          }),
        ],
        queue: {
          concurrency: 5,
          active: 1,
          background: 0,
          queues: [queue('job:umbra', { state: 'running', runs: [answering] })],
        },
      }),
    );
    expect(rail.working.map((entry) => [entry.subject, entry.action])).toEqual([
      ['Umbra Health', 'Continue after your answer'],
    ]);
  });

  it('shows the live step from the chat stream', () => {
    const live = {
      ...halcyon,
      activity: [
        {
          id: 'a',
          kind: 'tool',
          label: 'Reading the brief',
          status: 'running',
          startedAt: ago(1),
          finishedAt: null,
        },
      ],
    };
    const rail = model({ ...data, activityRuns: [live] } as Snapshot);
    expect(rail.working[0]?.activity).toBe('Reading the brief');
  });

  it('says every slot is free when nothing runs', () => {
    expect(idleLine(5)).toBe('Nothing is running. All 5 slots are free.');
    expect(idleLine(1)).toBe('Nothing is running. The work slot is free.');
    expect(model(snapshot()).working).toEqual([]);
  });
});

describe('Up next', () => {
  const ready = ['northwind', 'kestrel', 'tidepool'].map((company) => waiting(company));
  const cards = ['northwind', 'kestrel', 'tidepool'].map((id) => card(id, { company: id }));

  it('starts the first free slots’ worth, then counts places in line, naming each agent', () => {
    const rail = model(
      snapshot({ cards, queue: { concurrency: 5, active: 4, background: 0, queues: ready } }),
    );
    expect(rail.upNext.map((row) => [row.subject, row.action, row.agent, row.phrase])).toEqual([
      ['northwind', 'Evaluate fit', 'Scout', 'Starting'],
      ['kestrel', 'Evaluate fit', 'Scout', 'Next in line'],
      ['tidepool', 'Evaluate fit', 'Scout', '2nd in line'],
    ]);
    const full = model(
      snapshot({ cards, queue: { concurrency: 5, active: 5, background: 0, queues: ready } }),
    );
    expect(full.upNext.map((row) => row.phrase)).toEqual([
      'Next in line',
      '2nd in line',
      '3rd in line',
    ]);
  });

  it('shows a queue behind a promoted brief as waiting on the user, taking no place', () => {
    const quill = card('quill', {
      company: 'Quill Studio',
      state: 'shortlisted',
      applicationContext: brief(),
    });
    const data = snapshot({
      cards: [...cards, quill],
      queue: {
        concurrency: 5,
        active: 5,
        background: 0,
        queues: [ready[0]!, waiting('quill', 'draft', 'writer'), ready[1]!],
      },
    });
    const rows = model(data).upNext;
    expect(rows.map((row) => [row.subject, row.phrase])).toEqual([
      ['northwind', 'Next in line'],
      ['Quill Studio', 'Waits on you · brief'],
      ['kestrel', '2nd in line'],
    ]);
    expect(rows[1]).toMatchObject({
      itemKey: 'brief:quill',
      agent: 'Writer',
      action: 'Draft application',
    });
    // The same places the desk's record words read.
    expect(readyLine(installed(data), attentionItems(data)).map((entry) => entry.place)).toEqual(
      rows.map((row) => row.place),
    );
  });

  it('names a crew follow-up when a queue holds no request', () => {
    const parent = run('run-parent', { roleId: 'reviewer', status: 'completed' });
    const follow = queue('job:globex', {
      state: 'ready',
      tasks: [task('t1', { roleId: 'writer' })],
    });
    const data = snapshot({
      cards: [card('globex', { company: 'Globex' })],
      runs: [parent],
      queue: { concurrency: 1, active: 1, background: 0, queues: [follow] },
    });
    // The completed run's chain keeps its slot (the one active) until the follow-up starts.
    expect(model(data).upNext[0]).toMatchObject({
      action: 'Follow-up for Reviewer',
      agent: 'Writer',
      phrase: 'Starting',
      holdsSlot: true,
    });
  });

  it('words what an answer queued and a request in the user’s words to fit, never as a prompt', () => {
    // Answering a question queues the agent's own instruction as the request's text.
    const answered = queue('job:umbra', {
      state: 'ready',
      requests: [
        request('continue', {
          userInputId: 'question-1',
          content:
            'Continue your interrupted task after the user answered your question.\nOriginal request: Draft the cover letter',
          deliveries: [delivery('writer', 'queued')],
        }),
      ],
    });
    const asked = queue('conversation:t-offers', {
      state: 'ready',
      title: 'Offer comparison',
      requests: [
        request('offers', {
          content: 'Compare the Halcyon and Globex offers and summarize the trade-offs for me',
          deliveries: [delivery('writer', 'queued')],
        }),
      ],
    });
    const data = snapshot({
      cards: [card('umbra', { company: 'Umbra Health', state: 'drafting' })],
      queue: { concurrency: 5, active: 5, background: 0, queues: [answered, asked] },
    });
    expect(
      model(data).upNext.map((row) => [row.subject, row.action, row.agent, row.phrase]),
    ).toEqual([
      ['Umbra Health', 'Continue after your answer', 'Writer', 'Next in line'],
      ['Offer comparison', 'Compare the Halcyon and Globex offers and…', 'Writer', '2nd in line'],
    ]);
  });

  it('places rows again after a move, before the snapshot catches up', () => {
    const line = lineOf(3, 1);
    expect(line.map((row) => row.phrase)).toEqual(['Starting', 'Next in line', '2nd in line']);
    const moved = linePlaces([line[2]!, line[0]!, line[1]!], 1);
    expect(moved.map((row) => [row.subject, row.phrase])).toEqual([
      ['Q3', 'Starting'],
      ['Q1', 'Next in line'],
      ['Q2', '2nd in line'],
    ]);
    // Unchanged rows keep their identity.
    expect(linePlaces(line, 1)[0]).toBe(line[0]);
  });

  it('keeps a row that holds its slot starting wherever it moves, taking no free slot', () => {
    const [launch, ...rest] = lineOf(3, 0);
    const holding = { ...launch!, place: 'starting' as const, holdsSlot: true, phrase: 'Starting' };
    const moved = linePlaces([rest[0]!, holding, rest[1]!], 1);
    expect(moved.map((row) => [row.subject, row.phrase])).toEqual([
      ['Q2', 'Starting'],
      ['Q1', 'Starting'],
      ['Q3', 'Next in line'],
    ]);
    expect(moved[1]).toBe(holding);
  });

  it('draws the head and any released queue, folding the other stretches', () => {
    const line = lineOf(9);
    const segments = upNextSegments(line, new Set(['job:q6']));
    expect(
      segments.map((segment) =>
        segment.type === 'row' ? segment.row.subject : segment.rows.map((row) => row.subject),
      ),
    ).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', ['Q7', 'Q8', 'Q9']]);
    expect(upNextSegments(lineOf(5), new Set()).every((segment) => segment.type === 'row')).toBe(
      true,
    );
    const long = upNextSegments(lineOf(20), new Set());
    expect(long.at(-1)).toMatchObject({ type: 'more' });
    expect((long.at(-1) as { rows: UpNextRow[] }).rows).toHaveLength(17);
  });

  it('names two waiting jobs at most, so the summary never cuts a name', () => {
    expect(restNames(lineOf(1))).toBe('Q1');
    expect(restNames(lineOf(2))).toBe('Q1 and Q2');
    expect(restNames(lineOf(60))).toBe('Q1, Q2 and 58 more');
  });

  it('counts the queues the user paused', () => {
    const paused: WorkQueueView = {
      ...waiting('forma'),
      state: 'paused',
      paused: true,
      pauseKind: 'user',
    };
    const data = snapshot({
      queue: { concurrency: 5, active: 0, background: 0, queues: [paused] },
    });
    expect(model(data).heldByYou).toBe(1);
    expect(model(data).upNext).toEqual([]);
  });
});

describe('crew and pipeline', () => {
  it('counts the crew, its working agents and who runs several jobs', () => {
    const data = snapshot({
      runs: [
        run('w1', { cardId: 'acme', roleId: 'writer' }),
        run('w2', { cardId: 'globex', roleId: 'writer' }),
        run('s1', { cardId: 'lumen', roleId: 'scout' }),
        run('seat', { cardId: 'halcyon', roleId: 'reviewer', reviewSeatReservation: true }),
      ],
    });
    expect(model(data).crew).toEqual({
      summary: '6 agents, 2 working',
      working: ['scout', 'writer'],
      multi: ['Writer on 2 jobs'],
    });
  });

  it('counts open jobs by stage, the unscored leads and Closed apart', () => {
    const data = snapshot({
      cards: [
        card('a'),
        card('b', { fit: { score: 4 } as never }),
        card('c', { state: 'shortlisted' }),
        card('d', { state: 'drafting' }),
        card('e', { state: 'screening' }),
        card('f', { state: 'rejected' }),
      ],
    });
    const { pipeline } = model(data);
    expect(pipeline).toMatchObject({ open: 5, closed: 1, notScored: 1 });
    expect(pipeline.stages.map((stage) => [stage.label, stage.count])).toEqual([
      ['Leads', 2],
      ['Shortlisted', 1],
      ['In progress', 1],
      ['Applied', 1],
    ]);
  });
});
