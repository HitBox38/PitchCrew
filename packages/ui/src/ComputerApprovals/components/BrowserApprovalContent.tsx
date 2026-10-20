import { AccordionSection } from '@/components/ui/accordion/components/AccordionSection.tsx';
import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import type { ComputerApproval } from '@pitchcrew/core';
import { browserActionTitles, browserStatusLabels } from '../helpers.ts';
import { BrowserActionSummary } from './BrowserActionSummary.tsx';
import { BrowserApprovalActions } from './BrowserApprovalActions.tsx';
import type { ComputerApprovalsProps } from '../types.ts';

type Props = Pick<ComputerApprovalsProps, 'action' | 'working'> & {
  approval: ComputerApproval;
  showActions?: boolean;
};
export const BrowserApprovalContent = ({
  approval,
  action,
  working,
  showActions = true,
}: Props) => {
  const role = approval.roleId[0].toUpperCase() + approval.roleId.slice(1);
  return (
    <>
      <div className="approval-heading">
        <div>
          <h2>{browserActionTitles[approval.action.kind]}</h2>
          <p>
            {role} · {approval.page.title || 'New browser'}
          </p>
        </div>
        <span className={`badge ${approval.status === 'consumed' ? 'success' : ''}`}>
          {browserStatusLabels[approval.status]}
        </span>
      </div>
      <p className="approval-description">{approval.reason}</p>
      <p className="browser-page-url">Current page: {approval.page.url}</p>
      <BrowserActionSummary action={approval.action} />
      {approval.uploadDigest ? (
        <p className="quiet break-all">
          Exact upload SHA-256: {approval.uploadDigest} ?{' '}
          {approval.uploadMimeType || 'text/markdown'}
        </p>
      ) : null}
      {approval.uploadPreview ? (
        <AccordionSection className="approval-preview" heading="Review generated upload text">
          <SourceBlock
            label="Generated upload text"
            value={approval.uploadPreview}
            contentClassName="font-sans"
          />
        </AccordionSection>
      ) : null}
      {approval.uploadContent !== undefined ? (
        <AccordionSection className="approval-preview" heading="Review upload contents">
          <SourceBlock label="Upload contents" value={approval.uploadContent} />
        </AccordionSection>
      ) : null}
      <AccordionSection className="approval-preview" heading="Review the current page">
        <img
          className="computer-page-preview"
          src={`data:image/jpeg;base64,${approval.page.screenshot}`}
          alt="Browser page when this action was requested"
          width={approval.page.viewport?.width ?? 1280}
          height={approval.page.viewport?.height ?? 800}
        />
        <SourceBlock
          label="Captured page text"
          value={approval.page.text}
          contentClassName="font-sans"
        />
      </AccordionSection>
      <p className="browser-approval-note">
        This allows one interaction on this page. Clicks, typing and uploads may send information to
        the website.
      </p>
      {approval.error ? (
        <p className="form-error" role="alert">
          {approval.error}
        </p>
      ) : null}
      {showActions ? (
        <BrowserApprovalActions approval={approval} action={action} working={working} />
      ) : null}
    </>
  );
};
