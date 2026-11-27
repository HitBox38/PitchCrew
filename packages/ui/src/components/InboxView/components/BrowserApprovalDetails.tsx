import type { ComputerApproval } from '@pitchcrew/core';
import { BrowserActionSummary } from '@/ComputerApprovals/components/BrowserActionSummary.tsx';
import { BrowserApprovalError } from '@/ComputerApprovals/components/BrowserApprovalError.tsx';
import { AttachmentList } from '@/FileViewer/components/AttachmentList.tsx';
import { attachmentFiles } from '@/FileViewer/attachments.ts';

type Props = {
  approval: ComputerApproval;
  /** Leave out the screenshot tile where the host already shows the captured page (Home). */
  omitScreenshot?: boolean;
};

/** The exact browser interaction, the page it was reviewed on and the captured evidence. */
export const BrowserApprovalDetails = ({ approval, omitScreenshot }: Props) => {
  const files = attachmentFiles({ kind: 'browser', key: `browser:${approval.id}`, approval });
  return (
    <div className="packet-details">
      <p className="decide-lead">{approval.reason}</p>
      <p className="browser-page-url">Current page: {approval.page.url}</p>
      <BrowserActionSummary action={approval.action} />
      <section className="packet-section" aria-label="Captured page">
        <h3 className="packet-section-heading">
          Captured page <span>What the agent saw when it asked</span>
        </h3>
        <AttachmentList
          files={omitScreenshot ? files.filter((file) => file.id !== 'screenshot') : files}
        />
      </section>
      <BrowserApprovalError approval={approval} />
    </div>
  );
};
