import type { BrowserSessionInfo, Run, RunActivity } from '@pitchcrew/core';

/** The chat's right panel shows the job's packet or the agent's browser. */
export type BrowserPanelView = 'browser' | 'packet';

/** The view to show: Packet only in the split panel of a job with a packet. */
export const shownPanelView = ({
  view,
  packet,
  expanded,
}: {
  view: BrowserPanelView;
  packet: boolean;
  expanded: boolean;
}): BrowserPanelView => (packet && !expanded && view === 'packet' ? 'packet' : 'browser');

/** Tool steps and the latest public commentary of a run, for the expanded activity column. */
export const runActivitySummary = (activity: RunActivity[]) => ({
  steps: activity.filter((entry) => entry.kind !== 'commentary'),
  commentary: activity.findLast((entry) => entry.kind === 'commentary' && entry.text?.trim()),
});

export type BrowserStateTone =
  | 'closed'
  | 'opening'
  | 'idle'
  | 'browsing'
  | 'control'
  | 'paused'
  | 'waiting'
  | 'working';

/** Bead colour per state, following the bead law; null is an empty socket. */
export const browserStateBead: Record<BrowserStateTone, 'primary' | 'plum' | 'ochre' | null> = {
  closed: null,
  opening: null,
  idle: null,
  browsing: 'primary',
  control: 'primary',
  paused: 'ochre',
  waiting: 'ochre',
  working: 'plum',
};

/**
 * The panel's one answer to "who has this page right now": the header chip's label, bead and
 * tooltip. Permission mode (Supervised or Autonomous preparation) is detail, not state.
 */
export const browserState = ({
  session,
  leaseId,
  implicit,
  waiting,
  opening,
  name,
  elsewhere,
}: {
  session: BrowserSessionInfo | undefined;
  leaseId?: string;
  implicit: boolean;
  waiting: boolean;
  opening: boolean;
  name: string;
  elsewhere: boolean;
}): { tone: BrowserStateTone; label: string; detail: string } => {
  const mode =
    session?.mode === 'autonomous'
      ? ' Autonomous preparation: granted sites only; submitting still asks you.'
      : ' Supervised: every browser action asks for your approval.';
  const where = elsewhere ? ' This browser belongs to another conversation.' : '';
  const state = ((): { tone: BrowserStateTone; label: string; detail: string } => {
    if (session?.status !== 'open')
      return opening
        ? { tone: 'opening', label: 'Opening', detail: `Opening ${name}’s browser.` }
        : {
            tone: 'closed',
            label: 'Not open',
            detail: `${name}’s browser opens when you visit a page or ${name} starts using it.`,
          };
    if (leaseId && implicit)
      return {
        tone: 'browsing',
        label: 'You’re browsing',
        detail: `Private: ${name} doesn’t see what you type. It gets the page back when it starts working.`,
      };
    if (leaseId)
      return {
        tone: 'control',
        label: 'You have control',
        detail: `${name} is paused and doesn’t see what you type. Return control when you’re done.`,
      };
    if (session.manual)
      return {
        tone: 'paused',
        label: 'Paused',
        detail: `${name} is paused: control is held in another view or lapsed. Recover control to continue.`,
      };
    if (waiting)
      return {
        tone: 'waiting',
        label: 'Needs your OK',
        detail: `${name} is waiting for your decision below.${mode}`,
      };
    if (session.runId)
      return { tone: 'working', label: 'Working', detail: `${name} is using this browser.${mode}` };
    return {
      tone: 'idle',
      label: 'Idle',
      detail: `${name} isn’t using this browser. Browse it yourself; ${name} gets it back when it starts working.`,
    };
  })();
  return {
    ...state,
    label: elsewhere ? 'In another chat' : state.label,
    detail: `${state.detail}${where}`,
  };
};

/**
 * The reserved tray's quiet line while nothing waits for a decision: who has the page, in the
 * same words as the header chip. The tone is a bead colour; null is an empty (idle) socket.
 */
export const browserTrayLine = ({
  name,
  held,
  implicit,
  manual,
  working,
  step,
}: {
  name: string;
  held: boolean;
  implicit: boolean;
  manual: boolean;
  working: boolean;
  /** The run's latest public step, so the tray narrates the work instead of a placeholder. */
  step?: string;
}): { tone: 'primary' | 'plum' | 'ochre' | null; text: string } => {
  // The chip already says who has the page; the line adds what that means or what is happening.
  if (held && implicit && !working)
    return { tone: 'primary', text: `${name} gets the page back when it starts working.` };
  if (held)
    return {
      tone: 'primary',
      text: working
        ? `${name} waits until you return the page.`
        : `${name} can’t use this page until you return it.`,
    };
  if (manual) return { tone: 'ochre', text: `${name} is paused until you recover control.` };
  if (working)
    return {
      tone: 'plum',
      text: step ? `${name}: ${step}` : `${name}’s clicks, typing and submissions appear here.`,
    };
  return { tone: null, text: `Browse freely. ${name} takes the page back when it starts.` };
};

/**
 * The run the expanded activity column shows: the one using the browser, or else this agent's
 * latest run in this conversation, so its outcome stays readable after it finishes.
 */
export const shownBrowserRun = (
  runs: Run[],
  roleId: string,
  thread: string,
  runId: string | null | undefined,
) =>
  runId
    ? runs.find((run) => run.id === runId)
    : runs
        .filter((run) => run.roleId === roleId && run.threadId === thread && run.mode === 'chat')
        .reduce<Run | undefined>(
          (latest, run) => (!latest || run.startedAt > latest.startedAt ? run : latest),
          undefined,
        );
