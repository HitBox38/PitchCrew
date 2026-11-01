import type { ComputerApproval } from '@pitchcrew/core';
import { BrowserActionSummary } from '@/ComputerApprovals/components/BrowserActionSummary.tsx';
import { AttachmentList } from '@/FileViewer/components/AttachmentList.tsx';
import { attachmentFiles } from '@/FileViewer/attachments.ts';

/** The exact browser interaction, the page it was reviewed on and the captured evidence. */
export const BrowserApprovalDetails = ({ approval }: { approval: ComputerApproval }) => (
  <div className="packet-details">
    <p className="decide-lead">{approval.reason}</p>
    <p className="browser-page-url">Current page: {approval.page.url}</p>
    <BrowserActionSummary action={approval.action} />
    <section className="packet-section" aria-label="Captured page">
      <h3 className="packet-section-heading">
        Captured page <span>What the agent saw when it asked</span>
      </h3>
      <AttachmentList
        files={attachmentFiles({ kind: 'browser', key: `browser:${approval.id}`, approval })}
      />
    </section>
    {approval.error ? (
      <p role="alert" className="form-error">
        {approval.error}
      </p>
    ) : null}
  </div>
);
