import { BrowserApprovalActions } from '@/ComputerApprovals/components/BrowserApprovalActions.tsx';
import type { BrowserApprovalListProps } from '../types.ts';

/** Pinned approve/reject bar for one waiting browser interaction. */
export const BrowserDecisionFooter = ({
  computerApprovals,
  action,
  working,
}: BrowserApprovalListProps) => {
  const approval = computerApprovals[0];
  if (approval?.status !== 'pending') return null;
  return (
    <footer className="decide-footer" aria-label="Browser decision">
      <div className="decide-footer-bar">
        <div className="decide-actions">
          <BrowserApprovalActions approval={approval} action={action} working={working} />
        </div>
        <p className="decide-consequence">
          This approves one exact interaction on the reviewed page. Typing, clicking or uploading
          may send information to the website.
        </p>
      </div>
    </footer>
  );
};
