import type { TableGroup, TableView, ViewDef } from './types.ts';

/** Rows per page; Previous and Next reach every other job, as the board's own lists do. */
export const pageSize = 40;

/**
 * Saved views in three tracks: scope, what the crew is doing, and a lens. On hold has no bead: it
 * holds questions (ochre) and failures (rose) alike. Not scored is where Home's "{k} not scored"
 * and a job source scan lead.
 */
export const tableViews: readonly ViewDef[] = [
  { id: 'all', label: 'All open', track: 0 },
  { id: 'needs-you', label: 'Needs you', tone: 'ochre', track: 0 },
  { id: 'working', label: 'Working', tone: 'plum', track: 1 },
  { id: 'waiting', label: 'Waiting for a slot', tone: 'socket', track: 1 },
  { id: 'on-hold', label: 'On hold', track: 1 },
  { id: 'failed', label: 'Failed', tone: 'rose', track: 1 },
  { id: 'not-scored', label: 'Not scored', track: 2 },
];

export const trackNames = ['Scope', 'What the crew is doing', 'Lens'] as const;

/** All open's group labels, most pressing first. */
export const groupLabels: Record<TableGroup, string> = {
  needs: 'Needs you',
  working: 'Working',
  waiting: 'Waiting for a slot',
  held: 'On hold',
  idle: 'Nothing queued',
};

export const groupOrder: readonly TableGroup[] = ['needs', 'working', 'waiting', 'held', 'idle'];

/** An empty view keeps its frame and says what is true of it, never "no data". */
export const emptyLines: Record<TableView, string> = {
  all: 'No open jobs. Add a job post to start.',
  'needs-you': 'No job waits on you.',
  working: 'No agent is working on a job right now.',
  waiting: 'Nothing is waiting for a slot.',
  'on-hold': 'No job queue is on hold.',
  failed: 'Nothing failed.',
  'not-scored': 'Every lead has a fit score.',
};

export const closedEmpty = 'No closed jobs.';

/** The table's columns after the row checkbox, in order. */
export const tableColumns = [
  ['company', 'Company'],
  ['title', 'Title'],
  ['stage', 'Stage'],
  ['fit', 'Fit'],
  ['queue', 'Queue'],
  ['updated', 'Updated'],
] as const;

export type TableColumn = (typeof tableColumns)[number];

/** The quiet foot's keys; x only where rows can be selected. */
export const keyHints: readonly { keys: readonly string[]; label: string; select?: true }[] = [
  { keys: ['j', 'k'], label: 'move' },
  { keys: ['x'], label: 'select', select: true },
  { keys: ['Enter'], label: 'open' },
  { keys: ['/'], label: 'search' },
];
