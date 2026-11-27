import { useSyncExternalStore } from 'react';

export const timeAgo = (date: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 60000));
  return mins < 1
    ? 'Just now'
    : mins < 60
      ? `${mins}m ago`
      : mins < 1440
        ? `${Math.floor(mins / 60)}h ago`
        : new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

/**
 * One style per page: Home writes the long style ("4 min", "1 h 5 min"); the Pipeline table and
 * Crew keep the compact style already on those pages ("4m", "1h 5m").
 */
export type TimeStyle = 'long' | 'compact';

const wholeMinutes = (iso: string, now: number) => Math.floor((now - Date.parse(iso)) / 60_000);

/** How long ago: "just now", then "4 min", "12 h", "3 d" (compact "4m", "12h", "3d"). */
export const ageLabel = (iso: string, now: number, style: TimeStyle = 'long') => {
  const minutes = wholeMinutes(iso, now);
  if (Number.isNaN(minutes)) return '';
  if (minutes < 1) return 'just now';
  const [value, unit] =
    minutes < 60
      ? [minutes, 'min']
      : minutes < 1440
        ? [Math.floor(minutes / 60), 'h']
        : [Math.floor(minutes / 1440), 'd'];
  return style === 'long' ? `${value} ${unit}` : `${value}${unit === 'min' ? 'm' : unit}`;
};

/**
 * How long something has run: "just started", then "12 min", "1 h", "1 h 5 min" (compact "12m",
 * "1h", "1h 5m"). A whole hour says no minutes.
 */
export const durationLabel = (iso: string, now: number, style: TimeStyle = 'long') => {
  const minutes = wholeMinutes(iso, now);
  if (Number.isNaN(minutes)) return '';
  if (minutes < 1) return 'just started';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return style === 'compact' ? `${minutes}m` : `${minutes} min`;
  if (style === 'compact') return rest ? `${hours}h ${rest}m` : `${hours}h`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
};

/**
 * A time of day in the user's locale, "22:20" or "8:20 PM" (a 12-hour clock writes no leading
 * zero); empty for an unknown time.
 */
export const clockLabel = (at: string | number) => {
  const date = new Date(at);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const dayStart = (ms: number) => new Date(ms).setHours(0, 0, 0, 0);

/** Whole local days from `ms` to `now`; rounded, so a daylight-saving change still counts one. */
const daysBetween = (ms: number, now: number) =>
  Math.round((dayStart(now) - dayStart(ms)) / 86_400_000);

/** A day within the week by its name ("Mon"), further off by its date ("Nov 3"). */
const dayName = (ms: number, days: number) =>
  new Date(ms).toLocaleDateString(
    undefined,
    Math.abs(days) < 7 ? { weekday: 'short' } : { month: 'short', day: 'numeric' },
  );

/**
 * When something was, read after "since" or on its own: "22:20", "yesterday 22:20", "Mon 22:20",
 * "Nov 3 22:20"; empty for an unknown time.
 */
export const sinceLabel = (ms: number, now: number) => {
  if (Number.isNaN(ms)) return '';
  const clock = clockLabel(ms);
  const days = daysBetween(ms, now);
  if (days <= 0) return clock;
  if (days === 1) return `yesterday ${clock}`;
  return `${dayName(ms, days)} ${clock}`;
};

/**
 * When something will be, after its name: "at 08:00", "tomorrow at 08:00", "on Mon at 08:00", "on
 * Nov 30 at 08:00"; empty for an unknown time.
 */
export const untilLabel = (ms: number, now: number) => {
  if (Number.isNaN(ms)) return '';
  const clock = `at ${clockLabel(ms)}`;
  const days = -daysBetween(ms, now);
  if (days <= 0) return clock;
  if (days === 1) return `tomorrow ${clock}`;
  return `on ${dayName(ms, days)} ${clock}`;
};

// One clock for every relative time, so each stays current without its message rendering again.
const listeners = new Set<() => void>();
let ticking: ReturnType<typeof setInterval> | undefined;
const subscribe = (change: () => void) => {
  listeners.add(change);
  ticking ??= setInterval(() => {
    for (const listener of listeners) listener();
  }, 30000);
  return () => {
    listeners.delete(change);
    if (listeners.size) return;
    clearInterval(ticking);
    ticking = undefined;
  };
};
const halfMinute = () => Math.floor(Date.now() / 30000);
/**
 * Renders the caller again every half minute and returns the half minute it is in, so
 * `useClock() * 30_000` is a render-safe "now". Static rendering reads the same clock.
 */
export const useClock = () => useSyncExternalStore(subscribe, halfMinute, halfMinute);
