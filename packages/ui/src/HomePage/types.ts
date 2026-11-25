import type { Snapshot } from '@pitchcrew/core';
import type { AttentionItem, AttentionTier } from '@/lib/attention.ts';

/** What a closed row says, worded once per render so a row compares by content. */
export type RowLine = {
  subject: string;
  /** The kind of ask, under the subject: "Question from Writer". */
  kind: string;
  ask: string;
  /** The job's title, shown in the ask's place while the row is open and the ask is its headline. */
  context: string;
  /** How long it has waited ("4 min"); empty when the start is unknown or only a release date. */
  age: string;
  /** Said before the age to a screen reader: "waiting 4 min", but "asked just now". */
  ageCue: 'waiting' | 'asked';
  askedAt: string;
};

/** One tier of the desk: the entries it shows, then those folded behind its disclosure. */
export type DeskTier<T> = { tier: AttentionTier; shown: T[]; folded: T[] };

/**
 * One captioned group of the desk: a tier that still holds a live row, under its own caption, or a
 * run of adjacent tiers that hold only record lines, under one "Decided". `tier` is its first tier.
 */
export type DeskSection = {
  tier: AttentionTier;
  caption: string;
  decided: boolean;
  tiers: DeskTier<DeskEntry>[];
};

/**
 * One call a desk decision sent, exactly as the embedded component sent it. `failed` marks a later
 * call on a decided key that the daemon refused (a Skip's queue resume): its record says what did
 * not happen, never what did.
 */
export type DeskCall = { path: string; method: string; body: unknown; failed?: true };

/** An item as the desk last showed it, with the snapshot its open row was drawn from. */
export type DeskView = { item: AttentionItem; data: Snapshot };

/** How a record line's bead reads: done, or a positive outcome recorded. */
export type RecordTone = 'primary' | 'moss';

/** A decision made on the desk this session, kept where its row stood. */
export type DeskRecord = Pick<
  AttentionItem,
  'key' | 'kind' | 'tier' | 'askedAt' | 'expiresAt' | 'queueId' | 'tone'
> & {
  subject: string;
  /** The kind of ask it answered ("Question from Writer"), for the live region and fold nouns. */
  label: string;
  /** What happened and what did not, never cut. */
  text: string;
  bead: RecordTone;
  decidedAt: string;
  /** Orders records by creation, so a call knows whether its record was made while it ran. */
  seq: number;
  calls: DeskCall[];
  view: DeskView;
};

/** A desk call in flight: its row stays drawn from `view` even if a poll snapshot lacks it. */
export type DeskFlight = { view: DeskView; count: number };

/** The newest record, so the desk can open the next row, say what happened and arm its guard. */
export type DeskDecided = {
  key: string;
  seq: number;
  text: string;
  /** `performance.now()` when the deciding call started and when its record was made. */
  startedAt: number;
  at: number;
};

/** A row still waiting (or held in place while its call runs) and a record line. */
export type LiveEntry = {
  type: 'live';
  key: string;
  item: AttentionItem;
  /** The snapshot a held row is drawn from, while its call runs and a poll left it out. */
  kept: Snapshot | null;
  /** A call on it is in flight. */
  busy: boolean;
  tier: AttentionTier;
  tone: AttentionItem['tone'];
};
export type RecordEntry = {
  type: 'record';
  /** `record:{item key}:{decidedAt}`, never the live item's key. */
  key: string;
  record: DeskRecord;
  tier: AttentionTier;
  /** The decided item's tone, so a failure's record stays out of a fold as the failure did. */
  tone: AttentionItem['tone'];
};
export type DeskEntry = LiveEntry | RecordEntry;

/** Which row is open, since when, which rows were opened this visit and which folds are open. */
export type DeskState = {
  openKey: string | null;
  /** `performance.now()` when the open row opened; the decide shortcut waits after it. */
  armedAt: number;
  visited: ReadonlySet<string>;
  unfolded: ReadonlySet<AttentionTier>;
};

/** What an open row's body gets: its item, the snapshot to draw it from, and its row's state. */
export type BodyProps = {
  item: AttentionItem;
  data: Snapshot;
  open: boolean;
  armedAt: number;
  /** Focus is inside this row (its trigger or body); a question's digit keys need it. */
  focusWithin: boolean;
};
