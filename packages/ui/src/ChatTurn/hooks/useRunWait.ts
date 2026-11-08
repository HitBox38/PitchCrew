import type { Run } from '@pitchcrew/core';
import { useMemo } from 'react';
import { browserActionPublic, browserStepLabels } from '@pitchcrew/core/browser-action-labels';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useBrowserPresenceField } from '@/DesktopBrowserHost/presence.ts';

/**
 * Whether a running turn is waiting on the user rather than working: a browser request awaiting
 * their OK, or a page they hold. Chat, its header and the browser panel then tell one story.
 * `blocked` lists the labels of the browser calls that wait on them: the waiting request's own
 * call, or, while the user holds the page, every browser call (each waits for control first).
 */
export const useRunWait = (run: Run | undefined) => {
  const approvals = useWorkspaceStore((state) => state.data?.computerApprovals);
  const running = run?.status === 'running';
  const runId = run?.id ?? '';
  const heldRuns = useBrowserPresenceField('heldRuns');
  const held = running && heldRuns.includes(runId);
  return useMemo(() => {
    const own = running ? (approvals ?? []).filter((item) => item.runId === runId) : [];
    const approval = own.find((item) => item.status === 'pending');
    const blocked = approval
      ? [browserActionPublic(approval.action, approval.page)]
      : held
        ? [
            browserStepLabels.inspect,
            browserStepLabels.request,
            browserStepLabels.wait,
            browserStepLabels.tabs,
            browserStepLabels.assess,
            browserStepLabels.capture,
            ...own
              .filter((item) => item.status === 'approved')
              .map((item) => browserActionPublic(item.action, item.page)),
          ]
        : [];
    return { approval, held, waiting: !!approval || held, blocked };
  }, [approvals, held, runId, running]);
};
