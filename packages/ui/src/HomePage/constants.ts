import type { AttentionKind, AttentionTier } from '@/lib/attention.ts';

/** Why each tier ranks where it does; each caption labels its group of rows. */
export const tierCaptions: Record<AttentionTier, string> = {
  1: 'Ends soon or stops the crew',
  2: 'Queued work waits on you',
  3: 'Your move on a job',
  4: 'A record to confirm',
  5: 'Changes nothing until you adopt it',
};

/** The caption of a tier whose entries are all record lines. */
export const decidedCaption = 'Decided';

/** A tier shows this many entries before the rest fold; tier 1 and failed work never fold. */
export const foldShown = 3;

/**
 * Where the decide shortcut works: inside the open row, around its glazed verb. A kept-mounted
 * closed row never matches, so it never fires.
 */
export const deskScope = '.needs-row[data-open]';

/**
 * Where this device keeps when Home was last in front of the user: a plain ISO time, the baseline
 * of "Since you were last here". Per device by design; a shared marker would need a new event.
 */
export const seenKey = 'pitchcrew-home-seen-v1';

/** While Home is visible and focused, the baseline moves forward this often. */
export const seenEveryMs = 60_000;

/** For this long after a desk decision, a second click on the deciding spot does nothing. */
export const guardMs = 800;
/** How far from the deciding click "the spot" reaches, in CSS pixels. */
export const guardReach = 12;

/**
 * Each kind as a fold's summary names it, for one and for several. Tier 1 kinds never fold, and
 * neither does failed work, so a folded failure is always an interrupted request.
 */
export const kindNouns: Record<AttentionKind, readonly [string, string]> = {
  browser: ['browser action approval', 'browser action approvals'],
  connection: ['connection request', 'connection requests'],
  'profile-recovery': ['Profile update to recover', 'Profile updates to recover'],
  question: ['question', 'questions'],
  failure: ['interrupted request', 'interrupted requests'],
  verify: ['submission to verify', 'submissions to verify'],
  blocked: ['request on hold', 'requests on hold'],
  packet: ['packet', 'packets'],
  brief: ['job brief', 'job briefs'],
  export: ['packet to export', 'packets to export'],
  tracking: ['tracking review', 'tracking reviews'],
  'role-proposal': ['proposal', 'proposals'],
  'skill-proposal': ['skill suggestion', 'skill suggestions'],
  'instruction-update': ['instruction update', 'instruction updates'],
  'skill-update': ['skill update', 'skill updates'],
  'writing-suggestion': ['writing suggestion', 'writing suggestions'],
  'profile-proposal': ['Profile update', 'Profile updates'],
};

const opening = 'Opening it decides nothing.';

/**
 * What deciding does and does not do, under the verbs, for kinds whose embedded component has no
 * consequence line of its own. Browser approvals, packets, briefs, tracking reviews and proposals
 * keep their footer's own line; a question's body sets its own (`questionGate`) between its verbs
 * and its link to the conversation.
 */
export const gateLines: Partial<Record<AttentionKind, string>> = {
  connection: opening,
  'profile-recovery': 'Every agent waits until this update is retried.',
  failure: 'Recovery, not approval. A retry or resume rejoins the end of the waiting line.',
  verify: opening,
  blocked: 'Fix the prerequisite; the queue continues on its own.',
  export: opening,
  'instruction-update': opening,
  'skill-update': opening,
  'writing-suggestion': 'It changes the guide Writer and Reviewer share.',
  'profile-proposal': opening,
};

/** A question's consequence line, under Answer and continue. */
export const questionGate = 'Answering continues only the agent that asked.';
