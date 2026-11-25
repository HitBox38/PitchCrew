import type { Card, Snapshot } from '@pitchcrew/core';
import type { BeadTone } from '@/ClayInterface/helpers.ts';
import type { QueueStory } from '@/lib/queue-story.ts';

/** Saved views, as `?view=` names them. */
export type TableView =
  | 'all'
  | 'needs-you'
  | 'working'
  | 'waiting'
  | 'on-hold'
  | 'failed'
  | 'not-scored';

/** All open's groups, most pressing first; each job sits in the first that is true. */
export type TableGroup = 'needs' | 'working' | 'waiting' | 'held' | 'idle';

export type ViewDef = {
  id: TableView;
  label: string;
  /** The bead the view keys in the Queue column; 'socket' is the empty bead of a place in line. */
  tone?: 'ochre' | 'plum' | 'rose' | 'socket';
  /** Its track: scope, what the crew is doing, or a lens. */
  track: 0 | 1 | 2;
};

/** One job's row, built once per snapshot so row components never scan the snapshot. */
export type TableRowModel = {
  card: Card;
  stage: { tone: BeadTone | undefined; label: string };
  story: QueueStory;
  group: TableGroup;
  /** The saved views the job belongs to. */
  views: readonly TableView[];
  /** "12m ago", as the board's cards say it. */
  updated: string;
};

export type ViewCount = { matching: number; total: number };

/** Where a selection sits: on this page, on other pages of the view, or outside it. */
export type SelectionFacts = {
  count: number;
  onPage: number;
  otherPages: number;
  notShown: number;
  /** The header checkbox: every row of the page selected, or only some. */
  all: boolean;
  some: boolean;
};

export type PipelineTableProps = {
  data: Snapshot;
  query: string;
  /** The Closed view: the table over closed jobs, with no saved views and no selection. */
  closed: boolean;
  /** `?view=`, validated here: an unknown name falls back to All open. */
  view: string | undefined;
  chooseView: (view: TableView) => void;
  openCard: (id: string) => void;
};

/**
 * One job's outcome in a bulk result, as known when it was sent: `unconfirmed` is a call that got
 * no answer, which may or may not have queued the job.
 */
export type BulkOutcome = {
  cardId: string;
  company: string;
  kind: 'queued' | 'existing' | 'unsent' | 'unconfirmed';
  text: string;
  /** The line's bead by bead law; null draws a dash for a job that was not sent. */
  bead: 'plum' | 'ochre' | 'rose' | 'socket' | null;
};

/** A batch stopped by a workspace reason before anything was sent, or one line per job. */
export type BulkReport = { blocker: string } | { outcomes: BulkOutcome[] };
