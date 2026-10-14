import { ArtifactPreview } from './ArtifactPreview.tsx';
import { PacketApprovalActions } from './PacketApprovalActions.tsx';
import { PacketPreview } from './PacketPreview.tsx';
import { ApprovalReviewFrame } from './ApprovalReviewFrame.tsx';
import { packetStatusLabel } from '../helpers.ts';
import type { PacketApprovalListProps } from '../types.ts';
import { FolderOpen } from 'lucide-react';

export function PacketApprovalList({ approvals, data, ...actions }: PacketApprovalListProps) {
  return approvals.map((approval) => {
    const card = data.cards.find((item) => item.id === approval.cardId);
    return (
      <ApprovalReviewFrame
        key={approval.id}
        actions={
          card ? <PacketApprovalActions approval={approval} card={card} {...actions} /> : null
        }
      >
        <div className="approval-heading">
          <div>
            <h2>Export application packet</h2>
            <p>{card ? `${card.title} at ${card.company}` : 'Job no longer on the board'}</p>
          </div>
          <span className={`badge ${approval.status === 'consumed' ? 'success' : ''}`}>
            {packetStatusLabel(approval.status)}
          </span>
        </div>
        <p className="approval-description">
          Save the reviewed resume, cover letter, form answers, and note to your local packet
          folder. You can then apply yourself.
        </p>
        <PacketPreview approval={approval} />
        <ArtifactPreview approval={approval} pages={data.artifactPages} />
        {approval.exportDirectory ? (
          <p className="export-location">
            <FolderOpen size={14} /> {approval.exportDirectory}
          </p>
        ) : null}
      </ApprovalReviewFrame>
    );
  });
}
