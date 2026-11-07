import type { Run, UserInputRequest } from '@pitchcrew/core';

type QuestionTime = Pick<
  UserInputRequest,
  'runId' | 'createdAt' | 'answeredAt' | 'continuationRequestId'
>;
type ContinuationTime = Pick<Run, 'id' | 'requestId' | 'startedAt' | 'finishedAt'>;
type QuestionWait = QuestionTime & { continuations?: readonly ContinuationTime[] };

/** Parent turns settle with their continuation; every descendant's human wait is excluded. */
export const questionWaits = (
  runId: string,
  questions: readonly QuestionTime[],
  runs: readonly ContinuationTime[],
) => {
  const byRun = new Map<string, QuestionTime[]>();
  const byRequest = new Map<string, ContinuationTime[]>();
  for (const question of questions)
    byRun.set(question.runId, [...(byRun.get(question.runId) ?? []), question]);
  for (const run of runs)
    if (run.requestId) byRequest.set(run.requestId, [...(byRequest.get(run.requestId) ?? []), run]);
  const pending = [runId],
    visited = new Set<string>(),
    result: QuestionWait[] = [];
  for (let index = 0; index < pending.length; index++) {
    const current = pending[index]!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const question of byRun.get(current) ?? []) {
      const continuations = question.continuationRequestId
        ? (byRequest.get(question.continuationRequestId) ?? [])
        : [];
      result.push({ ...question, continuations });
      if (question.continuationRequestId) pending.push(...continuations.map((run) => run.id));
    }
  }
  return result;
};

/** Clamp and merge intervals so old, overlapping or incomplete question records cannot add work. */
export const turnTiming = (
  startedAt: string,
  finishedAt: string | null,
  now: number,
  questions: readonly (Pick<QuestionTime, 'createdAt' | 'answeredAt'> & Partial<QuestionWait>)[],
) => {
  const start = Date.parse(startedAt),
    end = finishedAt ? Date.parse(finishedAt) : now;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    return { worked: 0, waited: 0, queued: 0 };
  const human = questions.map(
    (question) =>
      [
        Date.parse(question.createdAt),
        question.answeredAt ? Date.parse(question.answeredAt) : end,
      ] as const,
  );
  const idle: [number, number][] = [];
  for (const question of questions) {
    if (!question.answeredAt || !question.continuationRequestId) continue;
    let cursor = Date.parse(question.answeredAt);
    for (const run of (question.continuations ?? []).toSorted((a, b) =>
      a.startedAt.localeCompare(b.startedAt),
    )) {
      idle.push([cursor, Date.parse(run.startedAt)]);
      cursor = Math.max(cursor, run.finishedAt ? Date.parse(run.finishedAt) : end);
    }
    idle.push([cursor, end]);
  }
  const waited = intervalLength(human, start, end);
  const excluded = intervalLength([...human, ...idle], start, end);
  return { worked: Math.max(0, end - start - excluded), waited, queued: excluded - waited };
};

const intervalLength = (
  ranges: readonly (readonly [number, number])[],
  start: number,
  end: number,
) => {
  const intervals = ranges
    .map(([from, to]) => [Math.max(start, from), Math.min(end, to)] as const)
    .filter(([from, to]) => Number.isFinite(from) && Number.isFinite(to) && to > from)
    .toSorted(([a], [b]) => a - b);
  let waited = 0,
    previousEnd = start;
  for (const [from, to] of intervals) {
    waited += Math.max(0, to - Math.max(from, previousEnd));
    previousEnd = Math.max(previousEnd, to);
  }
  return waited;
};
