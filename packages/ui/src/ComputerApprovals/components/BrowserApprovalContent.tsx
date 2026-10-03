import type { ComputerApproval } from '@pitchcrew/core';
import { browserActionTitles, browserStatusLabels } from '../helpers.ts';
import { BrowserActionSummary } from './BrowserActionSummary.tsx';
import { BrowserApprovalActions } from './BrowserApprovalActions.tsx';
import type { ComputerApprovalsProps } from '../types.ts';

type Props = Pick<ComputerApprovalsProps, 'action' | 'working'> & { approval: ComputerApproval };
export function BrowserApprovalContent({ approval, action, working }: Props) {
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
        <details className="approval-preview">
          <summary>Review generated upload text</summary>
          <pre>{approval.uploadPreview}</pre>
        </details>
      ) : null}
      {approval.uploadContent !== undefined ? (
        <details className="approval-preview">
          <summary>Review upload contents</summary>
          <pre>{approval.uploadContent}</pre>
        </details>
      ) : null}
      <details className="approval-preview">
        <summary>Review the current page</summary>
        <img
          className="computer-page-preview"
          src={`data:image/jpeg;base64,${approval.page.screenshot}`}
          alt="Browser page when this action was requested"
        />
        <pre>{approval.page.text}</pre>
      </details>
      <p className="browser-approval-note">
        This allows one interaction on this page. Clicks, typing and uploads may send information to
        the website.
      </p>
      {approval.error ? (
        <p className="form-error" role="alert">
          {approval.error}
        </p>
      ) : null}
      <BrowserApprovalActions approval={approval} action={action} working={working} />
    </>
  );
}
