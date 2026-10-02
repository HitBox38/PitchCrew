import type { PacketApprovalActionsProps } from '@/components/InboxView/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { timeAgo } from '@/lib/time.ts';
import { ArrowRight, Check, Download, X } from 'lucide-react';

export function PacketApprovalActions({
  approval,
  card,
  onOpen,
  working,
  act,
  action,
}: PacketApprovalActionsProps) {
  return (
    <div className="approval-footer">
      <Button className="text-button" onClick={() => onOpen(card.id)}>
        Open job <ArrowRight size={14} />
      </Button>
      <span className="subtle">{timeAgo(approval.createdAt)}</span>
      {approval.status === 'pending' ? (
        <>
          <Button
            disabled={working}
            className="button"
            onClick={() =>
              act(
                `/approvals/${approval.id}/decide`,
                { approved: false },
                'Export rejected; packet returned for review',
              )
            }
          >
            <X size={15} /> Reject
          </Button>
          <Button
            disabled={working}
            className="button primary"
            onClick={() =>
              act(
                `/approvals/${approval.id}/decide`,
                { approved: true },
                'Approved this exact packet for one local export',
              )
            }
          >
            <Check size={15} /> Approve export
          </Button>
        </>
      ) : approval.status === 'approved' ? (
        <Button
          disabled={working}
          className="button primary"
          onClick={() => {
            void action(
              `/approvals/${approval.id}/export`,
              'POST',
              undefined,
              (result) => `Packet exported to ${(result as { directory: string }).directory}`,
            ).catch(() => {});
          }}
        >
          <Download size={15} /> Export packet
        </Button>
      ) : null}
    </div>
  );
}
