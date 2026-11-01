import type { Approval, Snapshot } from '@pitchcrew/core';
import { AttachmentList } from '@/FileViewer/components/AttachmentList.tsx';
import { attachmentFiles } from '@/FileViewer/attachments.ts';
import { packetChecks } from '@/Decisions/helpers.ts';
import { DocumentFindings } from './DocumentFindings.tsx';
import { NeededFiles } from './NeededFiles.tsx';
import { HandoffSummary } from './PacketHandoff.tsx';
import { PacketExport } from './PacketExport.tsx';
import { packetHandoff } from '../handoff.ts';
import { resumePageWarning } from '../helpers.ts';

const filesNote = {
  pending: 'Exactly what you’re approving',
  approved: 'Exactly what you approved',
  consumed: 'Exactly what you approved',
  rejected: 'Exactly what was reviewed',
} as const;

/** Everything the user approves: the Reviewer's view, the exact frozen files and the export. */
export const PacketDetails = ({ approval, data }: { approval: Approval; data: Snapshot }) => {
  const card = data.cards.find((item) => item.id === approval.cardId);
  const warning = resumePageWarning(approval.artifacts ?? [], data.artifactPages);
  return (
    <div className="packet-details">
      <HandoffSummary
        handoff={packetHandoff(approval, data)}
        checks={packetChecks(approval, card)}
      />
      {warning ? <p className="packet-warning">{warning}</p> : null}
      <section className="packet-section" aria-label="Files">
        <h3 className="packet-section-heading">
          Files <span>{filesNote[approval.status]}</span>
        </h3>
        <AttachmentList
          files={attachmentFiles(
            { kind: 'packet', key: `packet:${approval.id}`, approval },
            data.artifactPages,
          )}
        />
        <DocumentFindings approval={approval} />
      </section>
      {card ? <NeededFiles approval={approval} card={card} /> : null}
      <PacketExport approval={approval} />
      {card ? null : (
        <p className="quiet">
          This job is no longer on the board. Its reviewed attachments remain available.
        </p>
      )}
    </div>
  );
};
