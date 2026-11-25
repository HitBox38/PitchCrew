import { useRef } from 'react';
import type { Card, TrackingSignal } from '@pitchcrew/core';
import { Button } from '@pitchcrew/design-system/button';
import { DecideHint } from '@/components/DecideHint/index.tsx';
import { useDecideShortcut } from '@/hooks/useDecideShortcut.ts';
import { useWorkspaceStore, type Action } from '@/WorkspaceStore/index.ts';

export type TrackingActionsProps = {
  signal: TrackingSignal;
  /** The chosen application; Apply update waits for one. */
  selected: Card | undefined;
  /** Sends the decision (default: the workspace's), so a host can decide through its own. */
  action?: Action;
  /** A surface's own scope (Home's open row): Control/Command+Enter presses Apply update. */
  shortcut?: string;
  /** When that surface showed the review (`performance.now()`); the shortcut waits after it. */
  armedAt?: number;
};

/** Apply the proposed status to the chosen application, reject it, or compare applications again. */
export const TrackingActions = ({
  signal,
  selected,
  action,
  shortcut,
  armedAt,
}: TrackingActionsProps) => {
  const apply = useRef<HTMLButtonElement>(null);
  const keys = useDecideShortcut(apply, shortcut, armedAt);
  const workspaceAction = useWorkspaceStore((state) => state.action);
  const working = useWorkspaceStore((state) => state.working);
  const act = (path: string, body: unknown, success: string) =>
    void (action ?? workspaceAction)(path, 'POST', body, success).catch(() => {});
  const path = `/tracking/evidence/${signal.id}`;
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        ref={apply}
        className="button primary"
        disabled={working || !selected}
        aria-keyshortcuts={shortcut ? keys.aria : undefined}
        title={shortcut ? `Apply update (${keys.label})` : undefined}
        onClick={() =>
          act(
            `${path}/decision`,
            { approved: true, cardId: selected?.id, cardUpdatedAt: selected?.updatedAt },
            'Tracking update applied',
          )
        }
      >
        Apply update
        {shortcut ? <DecideHint label={keys.label} /> : null}
      </Button>
      <Button
        className="button"
        disabled={working}
        onClick={() => act(`${path}/decision`, { approved: false }, 'Tracking update rejected')}
      >
        Reject
      </Button>
      <Button
        className="button"
        disabled={working}
        onClick={() => act(`${path}/refresh`, {}, 'Application comparison refreshed')}
      >
        Refresh comparison
      </Button>
    </div>
  );
};
