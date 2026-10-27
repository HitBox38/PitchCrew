import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { compareReadiness } from './readiness.ts';
import type { DailyReadiness, ReadinessInput } from './readiness.ts';

const date = (offset: number) =>
  new Date(Date.UTC(2026, 9, 27 + offset)).toISOString().slice(0, 10);
const row = (offset: number, observations = 20, allReady = 10): DailyReadiness => ({
  day: date(offset),
  observations,
  allReady,
  profileMissing: observations - allReady,
  crewMissing: 0,
  jobMissing: 0,
});
const input = (history = 28): ReadinessInput => ({
  endDate: date(0),
  firstSeen: date(-history),
  daily: Array.from({ length: Math.min(history, 28) }, (_, i) => row(i - Math.min(history, 28))),
});

test('a healthy new event can compare seven complete days with a labeled partial baseline', () => {
  const result = compareReadiness(input(15));
  assert.equal(result.decision, 'comparable');
  assert.equal(result.baselineKind, 'partial');
  assert.equal(result.baseline.days, 8);
  assert.equal(result.baseline.start, '2026-10-12');
  assert.equal(result.baseline.end, result.current.start);
  assert.equal(result.activityRatio, 1);
});

test('full history is capped at 21 baseline days; fewer than seven cannot compare', () => {
  for (const history of [28, 60]) {
    const result = compareReadiness(input(history));
    assert.equal(result.decision, 'comparable');
    assert.equal(result.baselineKind, 'full');
    assert.equal(result.baseline.days, 21);
  }
  assert.equal(compareReadiness(input(14)).decision, 'comparable');
  for (const history of [0, 6, 7, 13])
    assert.equal(compareReadiness(input(history)).reason, 'insufficient_history');
});

test('a capture stop cannot be hidden by moving the current window to the last observation', () => {
  const data = input(15);
  data.daily = data.daily.filter((day) => day.day <= date(-6));
  const result = compareReadiness(data);
  assert.equal(result.reason, 'capture_gap');
  assert.equal(result.current.start, date(-7));
  assert.equal(result.current.end, date(0));
});

test('large counts concentrated on two days do not establish steady current activity', () => {
  const data = input();
  data.daily = [...data.daily.filter((day) => day.day < date(-7)), row(-2, 100), row(-1, 100)];
  assert.equal(compareReadiness(data).reason, 'sparse_activity');
});

test('baseline coverage scales to partial history and missing days remain in the denominator', () => {
  const data = input(15);
  data.daily = data.daily.filter((day) => ![date(-15), date(-14), date(-13)].includes(day.day));
  assert.equal(compareReadiness(data).reason, 'sparse_activity');
  data.daily.push(row(-13));
  const result = compareReadiness(data);
  assert.equal(result.decision, 'comparable');
  assert.equal(result.baseline.days, 8);
  assert.equal(result.baseline.activeDays, 6);
  assert.equal(result.activityRatio, 4 / 3);
});

test('low observation volume and changes in daily activity stop rate comparisons', () => {
  const low = input();
  low.daily = low.daily.map((day) => ({ ...day, observations: 2, allReady: 1, profileMissing: 1 }));
  assert.equal(compareReadiness(low).reason, 'low_volume');
  for (const observations of [8, 50]) {
    const data = input();
    data.daily = data.daily.map((day) =>
      day.day >= date(-7)
        ? { ...day, observations, allReady: 0, profileMissing: observations }
        : day,
    );
    assert.equal(compareReadiness(data).reason, 'unsteady_activity');
  }
  for (const observations of [10, 40]) {
    const data = input();
    data.daily = data.daily.map((day) =>
      day.day >= date(-7)
        ? { ...day, observations, allReady: 0, profileMissing: observations }
        : day,
    );
    assert.equal(compareReadiness(data).decision, 'comparable');
  }
});

test('rates weight observations rather than daily percentages; comparable never means regression', () => {
  const data = input(14);
  data.daily = data.daily.map((day) =>
    day.day >= date(-7)
      ? {
          ...day,
          observations: day.day === date(-1) ? 100 : 10,
          allReady: day.day === date(-1) ? 100 : 0,
          profileMissing: day.day === date(-1) ? 0 : 10,
        }
      : day,
  );
  const result = compareReadiness(data);
  assert.equal(result.decision, 'comparable');
  assert.equal(result.current.rates.allReady, 100 / 160);
  const empty = compareReadiness({ ...input(), daily: [] });
  assert.equal(empty.current.rates.allReady, null);
  assert.equal(empty.decision, 'skip');
});

test('calendar windows stay seven days across Jerusalem DST', () => {
  const result = compareReadiness(input());
  assert.equal(result.current.start, '2026-10-20');
  assert.equal(result.current.end, '2026-10-27');
  assert.equal(result.current.days, 7);
});

test('invalid dates, overlapping buckets and missing/invalid counts fail closed', () => {
  for (const bad of [
    { ...row(-1), day: '2026-02-30' },
    row(0),
    row(-29),
    { ...row(-1), allReady: undefined },
    { ...row(-1), observations: -1 },
    { ...row(-1), observations: 1.5 },
    { ...row(-1), allReady: 21 },
    { ...row(-1), jobMissing: 11 },
    { ...row(-1), profileMissing: 0 },
    { ...row(-1), allReady: NaN },
  ])
    assert.throws(() => compareReadiness({ ...input(), daily: [bad as DailyReadiness] }));
  assert.throws(() => compareReadiness({ ...input(), daily: [row(-1), row(-1)] }));
  assert.throws(() => compareReadiness({ ...input(15), daily: [row(-16)] }));
});

test('the bundled CLI consumes aggregates and never echoes malformed input', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-readiness-'));
  try {
    const path = join(directory, 'input.json');
    const script = new URL('./readiness.ts', import.meta.url);
    await writeFile(path, JSON.stringify(input(15)));
    const run = () => spawnSync(process.execPath, [script.pathname, path], { encoding: 'utf8' });
    const result = run();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).baselineKind, 'partial');
    await writeFile(path, 'fictional-private-invalid-input');
    const failure = run();
    assert.equal(failure.status, 1);
    assert.equal(failure.stdout, '');
    assert.doesNotMatch(failure.stderr, /fictional-private/);
    const skill = await readFile(
      new URL('../../posthog/scouts/workspace-onboarding-readiness/SKILL.md', import.meta.url),
      'utf8',
    );
    assert.ok(skill.includes('scripts/readiness.ts'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
