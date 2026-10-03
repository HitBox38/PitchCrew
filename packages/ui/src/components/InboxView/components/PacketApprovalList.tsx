import { ArtifactPreview } from './ArtifactPreview.tsx';
import { PacketApprovalActions } from '@/components/InboxView/components/PacketApprovalActions.tsx';
import { PacketPreview } from '@/components/InboxView/components/PacketPreview.tsx';
import type { PacketApprovalListProps } from '@/components/InboxView/types.ts';
import { FolderOpen } from 'lucide-react';
import { useAppReducedMotion } from '@/AppMotion/hooks/useAppReducedMotion.ts';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';

export function PacketApprovalList({
  approvals,
  data,
  onOpen,
  working,
  act,
  action,
}: PacketApprovalListProps) {
  const reduced = useAppReducedMotion();
  return (
    <div className="approval-list">
      <AnimatePresence initial={false}>
        {approvals.map((approval) => {
          const card = data.cards.find((c) => c.id === approval.cardId)!;
          return (
            <m.section
              key={approval.id}
              className="approval-card"
              layout={reduced ? false : 'position'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, pointerEvents: 'none' }}
              transition={{ duration: 0.16 }}
            >
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
              <ArtifactPreview approval={approval} />
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
            </m.section>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
