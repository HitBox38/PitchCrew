import { stampText, type LensEntry, type LensGroup, type LensRow } from '@/lib/crew-lens.ts';

const plain = (text: string) =>
  text
    .trim()
    .replace(/[.…]+$/u, '')
    .toLowerCase();

/** A phrase inside a spoken list: a request's own closing stop never doubles the list's comma. */
const clause = (text: string) => text.trim().replace(/[.!?;:]+$/u, '');

/**
 * What an entry's line reads after the job: its action, or whose crew follow-up it is; never the
 * words its step line already says ("Evaluating fit" over a step that reads "Evaluating fit").
 */
export const entryAction = (entry: Pick<LensEntry, 'action' | 'followUpFor' | 'detail'>) => {
  if (entry.followUpFor) return `for ${entry.followUpFor}`;
  return plain(entry.action) === plain(entry.detail) ? '' : entry.action;
};

/** A separator stays at the end of its line: "… opens. ·" never leaves "· Reviewer…" below. */
export const keepSeparators = (text: string) => text.replaceAll(' · ', ' · ');

/** An entry's full name for its link: "Writer, Acme Robotics, Drafting the packet, running 12m". */
export const entryLabel = (agent: string, entry: LensEntry) => {
  const work = entry.followUpFor ? `crew follow-up for ${entry.followUpFor}` : entry.action;
  const words = [agent, entry.subject, clause(work), stampText(entry.stamp)]
    .filter(Boolean)
    .join(', ');
  return entry.itemKey ? `${words}. Decide in Needs you` : words;
};

/** A group's name for its disclosure: "Scout, Northwind, Kestrel AI, Tidepool, Evaluate fit…". */
export const groupLabel = (agent: string, group: LensGroup) =>
  [agent, group.names, clause(group.action), stampText(group.stamp)].filter(Boolean).join(', ');

/**
 * Busy rows in the order fixed when the lens mounted (`first`), so no row moves as its asks are
 * decided elsewhere; an agent that gets busy later joins after them, in roster order. Idle rows
 * leave for the idle tray.
 */
export const keptOrder = (first: readonly string[], rows: readonly LensRow[]) =>
  rows
    .map((row, index) => {
      const fixed = first.indexOf(row.roleId);
      return { row, place: fixed === -1 ? first.length + index : fixed };
    })
    .filter(({ row }) => !row.idle)
    .toSorted((a, b) => a.place - b.place)
    .map(({ row }) => row);

/** The stamp's state word takes the bead's tone only while it waits on the user or failed. */
export const stampTone = (entry: Pick<LensEntry, 'state' | 'tone'>) =>
  entry.state === 'asks' || entry.state === 'failed' ? entry.tone : undefined;
