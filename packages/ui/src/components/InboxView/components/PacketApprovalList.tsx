import { PacketApprovalActions } from '@/components/InboxView/components/PacketApprovalActions.tsx';
import { PacketPreview } from '@/components/InboxView/components/PacketPreview.tsx';
import type { PacketApprovalListProps } from '@/components/InboxView/types.ts';
import { FolderOpen } from 'lucide-react';

export function PacketApprovalList({
  approvals,
  data,
  onOpen,
  working,
  act,
  action,
}: PacketApprovalListProps) {
  return (
    <div className="approval-list">
      {approvals.map((approval) => {
        const card = data.cards.find((c) => c.id === approval.cardId)!;
        return (
          <section key={approval.id} className="approval-card">
            <div className="approval-heading">
              <div>
                <h2>Export application packet</h2>
                <p>
                  {card.title} at {card.company}
                </p>
              </div>
              <span className={`badge ${approval.status === 'consumed' ? 'success' : ''}`}>
                {approval.status === 'pending'
                  ? 'Needs approval'
                  : approval.status === 'approved'
                    ? 'Approved'
                    : approval.status === 'consumed'
                      ? 'Exported'
                      : 'Rejected'}
              </span>
            </div>
            <p className="approval-description">
              Save the reviewed resume, cover letter, form answers, and note to your local packet
              folder. You can then apply yourself.
            </p>
            <PacketPreview approval={approval} />
            <PacketApprovalActions
              approval={approval}
              card={card}
              onOpen={onOpen}
              working={working}
              act={act}
              action={action}
            />
            {approval.exportDirectory ? (
              <p className="export-location">
                <FolderOpen size={14} /> {approval.exportDirectory}
              </p>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
