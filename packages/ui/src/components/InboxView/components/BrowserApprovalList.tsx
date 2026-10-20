import type { BrowserApprovalListProps } from '../types.ts';
import { BrowserApprovalContent } from '@/ComputerApprovals/components/BrowserApprovalContent.tsx';
import { BrowserApprovalActions } from '@/ComputerApprovals/components/BrowserApprovalActions.tsx';
import { ApprovalReviewFrame } from './ApprovalReviewFrame.tsx';

export const BrowserApprovalList = ({
  computerApprovals,
  action,
  working,
}: BrowserApprovalListProps) => {
  return computerApprovals.map((approval) => (
    <ApprovalReviewFrame
      key={approval.id}
      actions={
        approval.status === 'pending' ? (
          <BrowserApprovalActions approval={approval} action={action} working={working} />
        ) : null
      }
    >
      <BrowserApprovalContent
        approval={approval}
        action={action}
        working={working}
        showActions={false}
      />
    </ApprovalReviewFrame>
  ));
};
