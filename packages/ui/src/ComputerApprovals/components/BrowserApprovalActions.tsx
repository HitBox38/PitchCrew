import { useRef, useState } from 'react';
import { Button } from '@pitchcrew/design-system/button';
import type { ComputerApproval } from '@pitchcrew/core';
import { DecideHint } from '@/components/DecideHint/index.tsx';
import { useDecideShortcut } from '@/hooks/useDecideShortcut.ts';
import { isMac } from '@/shortcuts.ts';
import type { ComputerApprovalsProps } from '../types.ts';
import { approveLabel, isFinalSubmission } from '../helpers.ts';

type Props = Pick<ComputerApprovalsProps, 'action' | 'working'> & {
  approval: ComputerApproval;
  /** Decided where the result is already visible (the browser tray): no success toast. */
  quiet?: boolean;
  /**
   * Control/Command+Enter approves while focus is inside this scope around the approve button:
   * true for the browser panel (the tray's copy), or a selector for a surface of its own (Home's
   * open row), where the approve button also shows the keys. A surface of its own never offers it
   * on a final submission (`isFinalSubmission`, a dialog continuing one included): focus moves on
   * to the next decision there, so a repeated press could reach one. The tray keeps it, beside the
   * live page.
   */
  shortcut?: boolean | string;
  /** When the surface showed this request (`performance.now()`); the shortcut waits after it. */
  armedAt?: number;
};

/** The decision for one browser request: the verb-specific approval first, then Reject. */
export const BrowserApprovalActions = ({
  approval,
  action,
  working,
  quiet,
  shortcut,
  armedAt,
}: Props) => {
  const [deciding, setDeciding] = useState<boolean | null>(null);
  const approve = useRef<HTMLButtonElement>(null);
  const submission = isFinalSubmission(approval.action);
  const scope = shortcut === true ? '#agent-browser-panel' : (!submission && shortcut) || undefined;
  const keys = useDecideShortcut(approve, scope, armedAt);
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
  const verb = approveLabel(approval.action);
  // The tray keeps its own wording of the keys; a surface with its own scope shows the app's label.
  const own = !!scope && shortcut !== true;
  const hint = own ? keys.label : `${isMac ? '⌘' : 'Ctrl'}+Enter`;
  return (
    <div className="approval-footer">
      <Button
        ref={approve}
        disabled={busy}
        className="button primary"
        aria-keyshortcuts={scope ? keys.aria : undefined}
        title={scope ? `${verb} (${hint})` : undefined}
        onClick={() => decide(true)}
      >
        {deciding === true ? 'Running…' : verb}
        {own && deciding === null ? <DecideHint label={keys.label} /> : null}
      </Button>
      <Button disabled={busy} className="button" onClick={() => decide(false)}>
        {deciding === false ? 'Rejecting…' : 'Reject'}
      </Button>
    </div>
  );
};
