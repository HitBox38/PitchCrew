import { Button } from '@/components/ui/button/components/Button.tsx';
import type { ComputerApprovalsProps } from '@/ComputerApprovals/types.ts';

export function ComputerApprovals({ approvals, action, working }: ComputerApprovalsProps) {
  return (
    <>
      {approvals.map((approval) => (
        <section className="approval-card" key={approval.id}>
          <div className="approval-heading">
            <div>
              <h2>Browser: {approval.action.kind}</h2>
              <p>
                {approval.roleId} · {approval.page.title || 'New browser'}
              </p>
            </div>
            <span className="badge">
              {approval.status === 'pending'
                ? 'Needs approval'
                : approval.status === 'consumed'
                  ? 'Executed'
                  : approval.status}
            </span>
          </div>
          <p className="approval-description">{approval.reason}</p>
          <p className="quiet">Page: {approval.page.url}</p>
          <pre className="computer-action-preview">{JSON.stringify(approval.action, null, 2)}</pre>
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
          <p className="quiet">
            This allows one interaction on this page. Clicks, typing and uploads may send
            information to the website.
          </p>
          {approval.error ? <output>{approval.error}</output> : null}
          {approval.status === 'pending' ? (
            <div className="approval-footer">
              <Button
                disabled={working}
                className="button"
                onClick={() => {
                  void action(
                    `/computer-approvals/${approval.id}/decide`,
                    'POST',
                    { approved: false },
                    'Browser action rejected',
                  ).catch(() => {});
                }}
              >
                Reject
              </Button>
              <Button
                disabled={working}
                className="button primary"
                onClick={() => {
                  void action(
                    `/computer-approvals/${approval.id}/decide`,
                    'POST',
                    { approved: true },
                    'Browser action approved for this run',
                  ).catch(() => {});
                }}
              >
                Approve interaction
              </Button>
            </div>
          ) : null}
        </section>
      ))}
    </>
  );
}
