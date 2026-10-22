import { AttachmentList } from '@/FileViewer/components/AttachmentList.tsx';
import { attachmentFiles } from '@/FileViewer/attachments.ts';
import { PacketApprovalActions } from './PacketApprovalActions.tsx';
import { DocumentFindings } from './DocumentFindings.tsx';
import type { PacketApprovalListProps } from '../types.ts';
import { resumePageWarning } from '../helpers.ts';
export const PacketApprovalList = ({ approvals, data, ...actions }: PacketApprovalListProps) => (
  <>
    {approvals.map((approval) => {
      const card = data.cards.find((item) => item.id === approval.cardId);
      const warning = resumePageWarning(approval.artifacts ?? [], data.artifactPages);
      return (
        <div className="mail-packet" key={approval.id}>
          <div className="mail-reading-body">
            <p>
              Your reviewed application packet is ready. Open the attachments to check the exact
              files, then approve the packet and choose how you’d like to apply.
            </p>
            {warning ? <p className="text-ochre">{warning}</p> : null}
            <DocumentFindings approval={approval} />
            <AttachmentList
              files={attachmentFiles(
                { kind: 'packet', key: `packet:${approval.id}`, approval },
                data.artifactPages,
              )}
            />
            {approval.exportDirectory ? (
              <p className="export-location">Saved locally: {approval.exportDirectory}</p>
            ) : null}
          </div>
          {card ? (
            <PacketApprovalActions approval={approval} card={card} data={data} {...actions} />
          ) : (
            <p className="quiet">
              This job is no longer on the board. Its reviewed attachments remain available.
            </p>
          )}
        </div>
      );
    })}
  </>
);
