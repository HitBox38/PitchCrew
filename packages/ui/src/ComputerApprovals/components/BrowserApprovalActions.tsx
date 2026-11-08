import { useEffect, useRef, useState } from 'react';
import { Button } from '@pitchcrew/design-system/button';
import type { ComputerApproval } from '@pitchcrew/core';
import type { ComputerApprovalsProps } from '../types.ts';
import { approveLabel } from '../helpers.ts';

type Props = Pick<ComputerApprovalsProps, 'action' | 'working'> & {
  approval: ComputerApproval;
  /** Decided where the result is already visible (the browser tray): no success toast. */
  quiet?: boolean;
  /** Control/Command+Enter approves while focus is in the browser panel (the tray's copy). */
  shortcut?: boolean;
};

const mac = () => /Mac|iPhone|iPad/.test(navigator.platform);

/** The decision for one browser request: the verb-specific approval first, then Reject. */
export const BrowserApprovalActions = ({ approval, action, working, quiet, shortcut }: Props) => {
  const [deciding, setDeciding] = useState<boolean | null>(null);
  const approve = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!shortcut) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.repeat) return;
      if (!(mac() ? event.metaKey : event.ctrlKey)) return;
      if (!document.activeElement?.closest('#agent-browser-panel')) return;
      event.preventDefault();
      approve.current?.click();
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [shortcut]);
  if (approval.status !== 'pending') return null;
  const decide = (approved: boolean) => {
    setDeciding(approved);
    void action(
      `/computer-approvals/${approval.id}/decide`,
      'POST',
      { approved },
      quiet
        ? undefined
        : approved
          ? 'Browser action approved for this run'
          : 'Browser action rejected',
    )
      .catch(() => {})
      .finally(() => setDeciding(null));
  };
  const busy = working || deciding !== null;
  return (
    <div className="approval-footer">
      <Button
        ref={approve}
        disabled={busy}
        className="button primary"
        aria-keyshortcuts={shortcut ? (mac() ? 'Meta+Enter' : 'Control+Enter') : undefined}
        title={
          shortcut ? `${approveLabel(approval.action)} (${mac() ? '⌘' : 'Ctrl'}+Enter)` : undefined
        }
        onClick={() => decide(true)}
      >
        {deciding === true ? 'Running…' : approveLabel(approval.action)}
      </Button>
      <Button disabled={busy} className="button" onClick={() => decide(false)}>
        {deciding === false ? 'Rejecting…' : 'Reject'}
      </Button>
    </div>
  );
};
