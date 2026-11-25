import type { WorkQueueView } from '@pitchcrew/core';
import type { stageCounts } from '@/board-stages.ts';
import type { LinePlace } from '@/lib/ready-line.ts';

/** A run executing in a job or conversation queue, as Working now and the work strip show it. */
export type RailRun = {
  runId: string;
  queueId: string;
  cardId: string | null;
  threadId: string;
  /** The company, or the conversation's title. */
  subject: string;
  /** What it does: its workflow purpose, routine or request ("Reviewing the packet"). */
  action: string;
  roleId: string;
  /** The agent, and whose crew follow-up it runs: "Writer for Reviewer". */
  agent: string;
  /** Its latest public step, or "Waiting for your OK" while a browser approval waits. */
  activity: string;
  startedAt: string;
  /** When its pending browser approval was asked: the run waits on the user, not working. */
  waitingSince: string | null;
  /** That approval's Needs you row. */
  itemKey: string | null;
};

/** The slots: `active of concurrency` is the authority; any surplus over what shows is starting. */
export type RailSlots = {
  active: number;
  concurrency: number;
  /** Routine lanes holding slots outside the job and conversation queues. */
  background: number;
  starting: number;
};

/** A queue waiting for a slot, in workspace order. */
export type UpNextRow = {
  /** The queue's id, so the line reorders as Queue's does. */
  id: string;
  cardId: string | null;
  threadId: string;
  subject: string;
  /** Its next action ("Evaluate fit"), the request's words, or a crew follow-up. */
  action: string;
  roleId: string | null;
  /** The agent its next delivery waits for; empty when none is named. */
  agent: string;
  place: LinePlace;
  /** It already has its work slot (a launch under way, a crew follow-up's kept chain). */
  holdsSlot: boolean;
  /** "Starting", "Next in line", "2nd in line"… or "Waits on you · brief". */
  phrase: string;
  /** The brief item a promoted queue waits behind. */
  itemKey: string | null;
};

/** One stretch of Up next: a row drawn in full, or a run of rows summed up in one line. */
export type UpNextSegment =
  | { type: 'row'; row: UpNextRow }
  | { type: 'more'; key: string; rows: UpNextRow[] };

/** The crew in a line: every agent counted, the working ones as pebbles, and who runs several jobs. */
export type RailCrew = { summary: string; working: string[]; multi: string[] };

/** Everything the rail and the work strip show, from one snapshot. */
export type RailModel = {
  working: RailRun[];
  /** One line per slot held only by a deep review's seat reservation. */
  reserved: string[];
  /** Null before the queue is known. */
  slots: RailSlots | null;
  /** The ready queues in workspace order, for Queue's own reorder moves. */
  ready: WorkQueueView[];
  upNext: UpNextRow[];
  /** Queues the user paused. */
  heldByYou: number;
  crew: RailCrew;
  pipeline: ReturnType<typeof stageCounts>;
};

/** Where a rail or since row leads: its Needs you item, the job's details, or the conversation. */
export type HomeLinks = {
  show: (key: string) => void;
  openCard: (id: string) => void;
};
