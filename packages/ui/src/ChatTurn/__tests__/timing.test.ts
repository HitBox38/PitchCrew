import { expect, it } from 'vitest';
import { questionWaits, turnTiming } from '../timing.ts';
import { elapsedLabel } from '../helpers.ts';

const time = (seconds: number) => new Date(seconds * 1000).toISOString();

it('reports agent work rather than a hundred minutes spent waiting for the user', () => {
  const timing = turnTiming('2026-11-06T18:53:09Z', '2026-11-06T20:33:28Z', 0, [
    {
      createdAt: '2026-11-06T18:53:20Z',
      answeredAt: '2026-11-06T20:33:22Z',
    },
  ]);
  expect(elapsedLabel(timing.worked)).toBe('17s');
  expect(elapsedLabel(timing.waited)).toBe('100m 2s');
});

it('freezes active work at the question while a pending human wait grows', () => {
  const question = [{ createdAt: time(11) }];
  expect(turnTiming(time(0), null, 40_000, question)).toEqual({
    worked: 11_000,
    waited: 29_000,
    queued: 0,
  });
  expect(turnTiming(time(0), null, 80_000, question).worked).toBe(11_000);
  expect(turnTiming(time(0), time(14), 80_000, question).worked).toBe(11_000);
});

it('excludes successive descendant waits without excluding another concurrent conversation', () => {
  const questions = [
    {
      runId: 'first',
      createdAt: time(10),
      answeredAt: time(50),
      continuationRequestId: 'request-2',
    },
    {
      runId: 'second',
      createdAt: time(55),
      answeredAt: time(85),
      continuationRequestId: 'request-3',
    },
    { runId: 'elsewhere', createdAt: time(0), answeredAt: time(100) },
  ];
  const runs = [
    { id: 'first', startedAt: time(0), finishedAt: time(100) },
    { id: 'second', requestId: 'request-2', startedAt: time(50), finishedAt: time(100) },
    { id: 'third', requestId: 'request-3', startedAt: time(85), finishedAt: time(100) },
  ];
  const waits = questionWaits('first', questions, runs);
  expect(waits.map((question) => question.runId)).toEqual(['first', 'second']);
  expect(turnTiming(time(0), time(100), 0, waits)).toEqual({
    worked: 30_000,
    waited: 70_000,
    queued: 0,
  });
  expect(turnTiming(time(50), time(100), 0, questionWaits('second', questions, runs)).worked).toBe(
    20_000,
  );
});

it('merges overlapping waits and clips them to the turn bounds', () => {
  expect(
    turnTiming(time(10), time(30), 0, [
      { createdAt: time(0), answeredAt: time(20) },
      { createdAt: time(15), answeredAt: time(25) },
      { createdAt: time(29), answeredAt: time(50) },
    ]),
  ).toEqual({ worked: 4_000, waited: 16_000, queued: 0 });
});

it('handles invalid or backwards timestamps without inventing work', () => {
  expect(turnTiming('invalid', time(20), 0, [])).toEqual({ worked: 0, waited: 0, queued: 0 });
  expect(turnTiming(time(20), time(10), 0, [])).toEqual({ worked: 0, waited: 0, queued: 0 });
  expect(turnTiming(time(0), time(20), 0, [{ createdAt: 'invalid' }]).worked).toBe(20_000);
});

it('retains ordinary turn duration and terminates malformed continuation cycles', () => {
  expect(turnTiming(time(0), time(20), 0, [])).toEqual({ worked: 20_000, waited: 0, queued: 0 });
  const questions = [{ runId: 'first', createdAt: time(1), continuationRequestId: 'same' }];
  expect(
    questionWaits('first', questions, [
      { id: 'first', requestId: 'same', startedAt: time(0), finishedAt: time(20) },
    ]),
  ).toHaveLength(1);
});

it('excludes queued slot or pause time before a continuation begins', () => {
  const waits = questionWaits(
    'first',
    [
      {
        runId: 'first',
        createdAt: time(10),
        answeredAt: time(50),
        continuationRequestId: 'next',
      },
    ],
    [{ id: 'second', requestId: 'next', startedAt: time(80), finishedAt: time(90) }],
  );
  expect(turnTiming(time(0), time(90), 0, waits)).toEqual({
    worked: 20_000,
    waited: 40_000,
    queued: 30_000,
  });
  expect(
    turnTiming(
      time(0),
      time(60),
      0,
      questionWaits(
        'first',
        [
          {
            runId: 'first',
            createdAt: time(10),
            answeredAt: time(50),
            continuationRequestId: 'not-started',
          },
        ],
        [],
      ),
    ),
  ).toEqual({ worked: 10_000, waited: 40_000, queued: 10_000 });
});

it('excludes idle gaps between failed and retried continuation attempts', () => {
  const waits = questionWaits(
    'first',
    [
      {
        runId: 'first',
        createdAt: time(10),
        answeredAt: time(50),
        continuationRequestId: 'next',
      },
    ],
    [
      { id: 'failed', requestId: 'next', startedAt: time(80), finishedAt: time(85) },
      { id: 'retried', requestId: 'next', startedAt: time(100), finishedAt: time(110) },
    ],
  );
  expect(turnTiming(time(0), time(110), 0, waits)).toEqual({
    worked: 25_000,
    waited: 40_000,
    queued: 45_000,
  });
});
