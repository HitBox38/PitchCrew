import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export type DailyReadiness = {
  day: string;
  observations: number;
  allReady: number;
  profileMissing: number;
  crewMissing: number;
  jobMissing: number;
};

export type ReadinessInput = { endDate: string; firstSeen: string; daily: DailyReadiness[] };

const dateNumber = (date: string) => {
  const value = Date.parse(`${date}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(value) ||
    new Date(value).toISOString().slice(0, 10) !== date
  )
    throw new Error('Invalid calendar date');
  return value / 86400_000;
};
const dateLabel = (day: number) => new Date(day * 86400_000).toISOString().slice(0, 10);
const counts = ['allReady', 'profileMissing', 'crewMissing', 'jobMissing'] as const;

/** Eligibility only: a comparable window still needs corroborated, sustained evidence. */
export const compareReadiness = ({ endDate, firstSeen, daily }: ReadinessInput) => {
  const end = dateNumber(endDate);
  const first = dateNumber(firstSeen);
  const currentStart = end - 7;
  const baselineStart = Math.min(currentStart, Math.max(end - 28, first));
  const seen = new Set<string>();
  for (const row of daily) {
    const day = dateNumber(row.day);
    if (day < end - 28 || day >= end || day < first || seen.has(row.day))
      throw new Error('Duplicate or out-of-window observation day');
    seen.add(row.day);
    if (
      !Number.isSafeInteger(row.observations) ||
      row.observations < 0 ||
      counts.some(
        (key) => !Number.isSafeInteger(row[key]) || row[key] < 0 || row[key] > row.observations,
      )
    )
      throw new Error('Invalid aggregate counts');
    if (counts.slice(1).some((key) => row.allReady + row[key] > row.observations))
      throw new Error('Ready and missing counts overlap');
    if (row.profileMissing + row.crewMissing + row.jobMissing < row.observations - row.allReady)
      throw new Error('Incomplete prerequisite counts');
  }
  const summarize = (start: number, stop: number) => {
    const rows = daily.filter((row) => dateNumber(row.day) >= start && dateNumber(row.day) < stop);
    const observations = rows.reduce((sum, row) => sum + row.observations, 0);
    return {
      start: dateLabel(start),
      end: dateLabel(stop),
      days: stop - start,
      observations,
      activeDays: rows.filter((row) => row.observations > 0).length,
      rates: Object.fromEntries(
        counts.map((key) => [
          key,
          observations ? rows.reduce((sum, row) => sum + row[key], 0) / observations : null,
        ]),
      ),
    };
  };
  const baseline = summarize(baselineStart, currentStart);
  const current = summarize(currentStart, end);
  const baselineKind = baseline.days === 21 ? 'full' : 'partial';
  const activityRatio =
    baseline.observations && baseline.days
      ? current.observations / 7 / (baseline.observations / baseline.days)
      : null;
  const latest = daily
    .filter((row) => row.observations > 0)
    .reduce((last, row) => Math.max(last, dateNumber(row.day)), -Infinity);
  const reason =
    baseline.days < 7
      ? 'insufficient_history'
      : latest < end - 2
        ? 'capture_gap'
        : baseline.observations < 50 || current.observations < 50
          ? 'low_volume'
          : current.activeDays < 5 || baseline.activeDays < Math.ceil((5 * baseline.days) / 7)
            ? 'sparse_activity'
            : activityRatio === null || activityRatio < 0.5 || activityRatio > 2
              ? 'unsteady_activity'
              : null;
  return {
    decision: reason ? 'skip' : 'comparable',
    reason,
    baselineKind,
    baseline,
    current,
    activityRatio,
  };
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Expected one aggregate JSON input file');
    console.log(
      JSON.stringify(compareReadiness(JSON.parse(readFileSync(process.argv[2], 'utf8')))),
    );
  } catch {
    console.error('Invalid readiness input; expected complete-day aggregate counts only.');
    process.exitCode = 1;
  }
}
