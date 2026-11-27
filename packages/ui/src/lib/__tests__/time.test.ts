import { describe, expect, it } from 'vitest';
import { ageLabel, clockLabel, durationLabel, sinceLabel, untilLabel } from '../time.ts';

const now = new Date(2026, 10, 18, 9, 0).getTime();
const before = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

describe('time words', () => {
  it('writes ages in the long and compact styles', () => {
    expect([0, 4, 59, 60, 12 * 60, 3 * 1440].map((m) => ageLabel(before(m), now))).toEqual([
      'just now',
      '4 min',
      '59 min',
      '1 h',
      '12 h',
      '3 d',
    ]);
    expect([0, 4, 12 * 60, 3 * 1440].map((m) => ageLabel(before(m), now, 'compact'))).toEqual([
      'just now',
      '4m',
      '12h',
      '3d',
    ]);
    // A future time (a clock ahead of the daemon) reads as just now; an unknown one as nothing.
    expect(ageLabel(before(-5), now)).toBe('just now');
    expect(ageLabel('', now)).toBe('');
  });

  it('writes durations in the long and compact styles', () => {
    // A whole hour says no minutes: "1 h", never "1 h 0 min".
    expect([0, 12, 60, 65, 120].map((m) => durationLabel(before(m), now))).toEqual([
      'just started',
      '12 min',
      '1 h',
      '1 h 5 min',
      '2 h',
    ]);
    expect([0, 12, 60, 65].map((m) => durationLabel(before(m), now, 'compact'))).toEqual([
      'just started',
      '12m',
      '1h',
      '1h 5m',
    ]);
    expect(durationLabel('soon', now)).toBe('');
  });

  it('writes a clock time and when something was, for “since”', () => {
    // A 12-hour clock writes the hour with no leading zero ("7:05 AM", never "07:05 AM").
    const clock = (date: Date) =>
      date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const evening = new Date(2026, 10, 17, 22, 20);
    expect(clockLabel(evening.toISOString())).toBe(clock(evening));
    expect(clockLabel('')).toBe('');
    const morning = new Date(2026, 10, 18, 7, 5);
    expect(sinceLabel(morning.getTime(), now)).toBe(clock(morning));
    expect(sinceLabel(evening.getTime(), now)).toBe(`yesterday ${clock(evening)}`);
    const monday = new Date(2026, 10, 16, 22, 20);
    expect(sinceLabel(monday.getTime(), now)).toBe(
      `${monday.toLocaleDateString(undefined, { weekday: 'short' })} ${clock(monday)}`,
    );
    const older = new Date(2026, 10, 3, 22, 20);
    expect(sinceLabel(older.getTime(), now)).toBe(
      `${older.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${clock(older)}`,
    );
    expect(sinceLabel(Number.NaN, now)).toBe('');
  });

  it('writes when something will be, after its name', () => {
    const clock = (date: Date) =>
      date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const later = new Date(2026, 10, 18, 23, 30);
    expect(untilLabel(later.getTime(), now)).toBe(`at ${clock(later)}`);
    const tomorrow = new Date(2026, 10, 19, 8, 0);
    expect(untilLabel(tomorrow.getTime(), now)).toBe(`tomorrow at ${clock(tomorrow)}`);
    const friday = new Date(2026, 10, 20, 8, 0);
    expect(untilLabel(friday.getTime(), now)).toBe(
      `on ${friday.toLocaleDateString(undefined, { weekday: 'short' })} at ${clock(friday)}`,
    );
    const next = new Date(2026, 10, 30, 8, 0);
    expect(untilLabel(next.getTime(), now)).toBe(
      `on ${next.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${clock(next)}`,
    );
    // A time already past (a routine due now) reads as today's.
    expect(untilLabel(now - 60_000, now)).toBe(`at ${clockLabel(now - 60_000)}`);
    expect(untilLabel(Number.NaN, now)).toBe('');
  });
});
