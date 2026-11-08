import type { Run } from '@pitchcrew/core';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useBrowserPresenceField } from '@/DesktopBrowserHost/presence.ts';

/**
 * Whether a running turn is waiting on the user rather than working: a browser request awaiting
 * their OK, or a page they hold. Chat, its header and the browser panel then tell one story.
 */
export const useRunWait = (run: Run) => {
  const approval = useWorkspaceStore((state) =>
    run.status === 'running'
      ? state.data?.computerApprovals.find(
          (item) => item.runId === run.id && item.status === 'pending',
        )
      : undefined,
  );
  const held = useBrowserPresenceField('heldRuns').includes(run.id) && run.status === 'running';
  return { approval, held, waiting: !!approval || held };
};
