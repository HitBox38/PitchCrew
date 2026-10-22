import { Button } from '@/components/ui/button/components/Button.tsx';
import { Check, X } from 'lucide-react';
import type { PacketApprovalActionsProps } from '../types.ts';
import type { useSubmissionActions } from '../hooks/useSubmissionActions.ts';
type Props = PacketApprovalActionsProps & {
  model: ReturnType<typeof useSubmissionActions>;
  current: boolean;
  uncertain: boolean;
  disabled: boolean;
};
export const PendingPacketDecision = ({ approval, action, current, disabled, model }: Props) => (
  <>
    {current && approval.status === 'pending' ? (
      <>
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() =>
            void model.perform(() =>
              action(`/approvals/${approval.id}/decide`, 'POST', { approved: false }),
            )
          }
        >
          <X size={16} />
          Reject
        </Button>
        <Button
          disabled={disabled}
          onClick={() =>
            void model.perform(() =>
              action(`/approvals/${approval.id}/decide`, 'POST', { approved: true }),
            )
          }
        >
          <Check size={16} />
          Approve packet
        </Button>
      </>
    ) : null}
  </>
);
