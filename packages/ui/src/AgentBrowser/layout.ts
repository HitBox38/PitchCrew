import type { BrowserSessionInfo, RunActivity } from '@pitchcrew/core';

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
        : { tone: 'closed', label: 'Closed', detail: 'Browser closed.' };
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
    label: elsewhere ? `${state.label} elsewhere` : state.label,
    detail: `${state.detail}${where}`,
  };
};
