import { describe, expect, it } from 'vitest';
import type { Snapshot, WorkQueueView } from '@pitchcrew/core';
import { attentionItems, type AttentionKind } from '@/lib/attention.ts';
import {
  ago,
  card,
  delivery,
  everyKind,
  question,
  queue,
  request,
  run,
  snapshot,
  task,
} from '@/lib/__tests__/attention-fixture.ts';
import { clockLabel } from '@/lib/time.ts';
import { openRowWords, restatesHeadline, waitingOn } from '../helpers.ts';

const itemOf = (data: Snapshot, kind: AttentionKind) =>
  attentionItems(data).find((item) => item.kind === kind)!;

/** `everyKind()` with Corvid's job queue changed, for each way a request or follow-up stops. */
const corvid = (lane: Partial<WorkQueueView>) => {
  const data = everyKind();
  return {
    ...data,
    runs: [...data.runs, run('run-parent', { roleId: 'reviewer', status: 'completed' })],
    queue: {
      ...data.queue!,
      queues: data.queue!.queues.map((entry) =>
        entry.id === 'job:corvid' ? { ...entry, ...lane } : entry,
      ),
    },
  };
};
/** Corvid's fit, its delivery stopped with this error. */
const stopped = (error: string, status: 'failed' | 'paused' = 'failed') => [
  request('fit-corvid', {
    boardAction: 'fit',
    deliveries: [{ ...delivery('scout', status, 'run-corvid'), error }],
  }),
];
const failureWords = (data: Snapshot) => openRowWords(itemOf(data, 'failure'), data);

describe('The open row’s words', () => {
  it('releases a question’s slot only when no other run holds its queue', () => {
    // Waypoint: Reviewer runs in the job's queue while Writer waits on two questions.
    const review = run('run-review', { cardId: 'waypoint', roleId: 'reviewer' });
    const asked = (id: string) =>
      question(id, { cardId: 'waypoint', runId: `run-${id}`, question: `Question ${id}?` });
    const waypoint = (state: 'running' | 'waiting', runs = [review]) =>
      snapshot({
        cards: [card('waypoint', { company: 'Waypoint', state: 'drafting' })],
        runs,
        userInputs: [asked('question-1'), asked('question-2')],
        queue: {
          concurrency: 5,
          active: state === 'running' ? 1 : 0,
          background: 0,
          queues: [queue('job:waypoint', { state, runs: state === 'running' ? runs : [] })],
        },
      });
    const busy = waypoint('running');
    expect(attentionItems(busy).filter((item) => item.kind === 'question')).toHaveLength(2);
    expect(waitingOn(itemOf(busy, 'question'), busy)?.text).toBe(
      'Waypoint’s queue; Reviewer’s run still holds its slot.',
    );
    const free = waypoint('waiting', []);
    expect(waitingOn(itemOf(free, 'question'), free)?.text).toBe(
      'Waypoint’s queue; its slot is released.',
    );
  });

  it('heads a question with the question itself, as every kind heads its row with the ask', () => {
    const data = everyKind();
    const item = itemOf(data, 'question');
    const asked = data.userInputs!.find((entry) => entry.id === item.entityId)!;
    const words = openRowWords(item, data);
    expect(words.headline).toBe(asked.question);
    expect(words.provenance).toMatch(/^Writer asked/);
    // No kind leaves its open row without a headline.
    const items = attentionItems(data);
    expect(items.filter((entry) => !openRowWords(entry, data).headline)).toEqual([]);
  });

  it('says a failure once: a reason that restates the headline gives way to the agent', () => {
    // "Scout stopped." says again what "Scout’s fit evaluation stopped before finishing" says.
    expect(failureWords(everyKind())).toEqual({
      headline: 'Scout’s fit evaluation stopped before finishing',
      provenance: 'Scout',
    });
    for (const error of [
      'Scout stopped before finishing.',
      'Scout’s fit evaluation stopped before finishing. Retry or skip this request.',
    ])
      expect(failureWords(corvid({ requests: stopped(error) })).provenance).toBe('Scout');
    // A reason with a fact of its own stays: after the agent, or verbatim when it names it.
    expect(failureWords(corvid({ requests: stopped('Codex exited (1).') })).provenance).toBe(
      'Scout · Codex exited (1).',
    );
    const named = 'Scout stopped: the runtime exited with code 1.';
    expect(failureWords(corvid({ requests: stopped(named) })).provenance).toBe(named);
  });

  it('says an interrupted request or follow-up once, and keeps a cause the headline lacks', () => {
    // A restart's own words under "… was interrupted when Pitchcrew stopped".
    const restart = corvid({
      pauseKind: 'interrupted',
      reason: 'Interrupted by daemon restart. Retry or skip this request.',
      requests: stopped('', 'paused'),
    });
    expect(failureWords(restart)).toEqual({
      headline: 'Scout’s fit evaluation was interrupted when Pitchcrew stopped',
      provenance: 'Scout',
    });
    const followUp = (pauseKind: 'failed' | 'interrupted') =>
      corvid({
        pauseKind,
        requests: [],
        tasks: [
          task('task-1', {
            status: 'failed',
            error: 'The daemon stopped. Retry or skip this follow-up.',
          }),
        ],
      });
    expect(failureWords(followUp('interrupted'))).toEqual({
      headline: 'Writer’s follow-up for Reviewer was interrupted when Pitchcrew stopped',
      provenance: 'Writer',
    });
    // Under "stopped before finishing" the same words name the cause, so they stay.
    expect(failureWords(followUp('failed')).provenance).toBe(
      'Writer · The daemon stopped. Retry or skip this follow-up.',
    );
    // An echo followed by a fact of its own is kept whole.
    expect(
      restatesHeadline(
        'Scout stopped. Codex exited.',
        'Scout’s review stopped before finishing',
        'Scout',
      ),
    ).toBe(false);
  });

  it('frames a queue’s saved reason as history once nothing stopped is left in it', () => {
    const stuck = corvid({
      requests: [
        request('fit-new', { boardAction: 'fit', deliveries: [delivery('scout', 'queued')] }),
      ],
    });
    expect(failureWords(stuck)).toEqual({
      headline: 'Paused until you resume the queue',
      provenance: 'Paused when: Scout’s fit evaluation stopped before finishing.',
    });
  });

  it('gives provenance the pebble of the agent that acted', () => {
    const data = everyKind();
    // Juniper's packet names no review run: Reviewer agreed, from the Reviewer seat.
    expect(openRowWords(itemOf(data, 'packet'), data)).toMatchObject({
      provenance: expect.stringMatching(/^Reviewer agreed at /),
      by: 'reviewer',
    });
    expect(openRowWords(itemOf(data, 'export'), data).by).toBe('reviewer');
    // A brief names its extracting agent only when that run saved it.
    const quill = data.cards.find((entry) => entry.company === 'Quill Studio')!;
    const saved = quill.applicationContext!.createdAt;
    expect(openRowWords(itemOf(data, 'brief'), data)).toMatchObject({
      provenance: `Extracted at ${clockLabel(saved)}`,
      by: null,
    });
    const extraction = run('run-extract', {
      cardId: quill.id,
      roleId: 'scout',
      purpose: 'source-extraction',
      status: 'completed',
      startedAt: ago(302),
      finishedAt: new Date(Date.parse(saved) - 20).toISOString(),
    });
    const extracted = { ...data, runs: [...data.runs, extraction] };
    expect(openRowWords(itemOf(extracted, 'brief'), extracted)).toMatchObject({
      provenance: `Scout extracted it at ${clockLabel(saved)}`,
      by: 'scout',
    });
  });
});
