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

export type BrowserModeChip = {
  tone: 'private' | 'autonomous' | 'supervised';
  label: string;
  detail: string;
};

/** The current task's browsing permission, or null when no agent turn or takeover is active. */
export const browserModeChip = (
  session: BrowserSessionInfo | undefined,
  hasControl: boolean,
): BrowserModeChip | null => {
  if (hasControl || session?.manual)
    return {
      tone: 'private',
      label: 'Private',
      detail: 'Manual control: the agent is paused and what you type is not saved.',
    };
  if (!session?.runId) return null;
  return session.mode === 'autonomous'
    ? {
        tone: 'autonomous',
        label: 'Autonomous preparation',
        detail: 'Captured for this task: granted sites only; submitting still asks you.',
      }
    : {
        tone: 'supervised',
        label: 'Supervised',
        detail: 'Captured for this task: every browser action asks for your approval.',
      };
};

/** Tool steps and the latest public commentary of a run, for the expanded activity column. */
export const runActivitySummary = (activity: RunActivity[]) => ({
  steps: activity.filter((entry) => entry.kind !== 'commentary'),
  commentary: activity.findLast((entry) => entry.kind === 'commentary' && entry.text?.trim()),
});
