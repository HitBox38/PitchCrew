import type { BrowserApprovalListProps } from '../types.ts';
import { BrowserApprovalActions } from '@/ComputerApprovals/components/BrowserApprovalActions.tsx';
import { BrowserActionSummary } from '@/ComputerApprovals/components/BrowserActionSummary.tsx';
import { AttachmentList } from '@/FileViewer/components/AttachmentList.tsx';
import { attachmentFiles } from '@/FileViewer/attachments.ts';
export const BrowserApprovalList = ({
  computerApprovals,
  action,
  working,
}: BrowserApprovalListProps) => (
  <>
    {computerApprovals.map((approval) => (
      <div className="mail-packet" key={approval.id}>
        <div className="mail-reading-body">
          <p>{approval.reason}</p>
          <p className="browser-page-url">Current page: {approval.page.url}</p>
          <BrowserActionSummary action={approval.action} />
          <AttachmentList
            files={attachmentFiles({ kind: 'browser', key: `browser:${approval.id}`, approval })}
          />
          <p className="quiet">
            This approves one exact interaction on the reviewed page. Typing, clicking or uploading
            may send information to the website.
          </p>
          {approval.error ? (
            <p role="alert" className="form-error">
              {approval.error}
            </p>
          ) : null}
        </div>
        {approval.status === 'pending' ? (
          <div className="mail-decision-footer">
            <BrowserApprovalActions approval={approval} action={action} working={working} />
          </div>
        ) : null}
      </div>
    ))}
  </>
);
