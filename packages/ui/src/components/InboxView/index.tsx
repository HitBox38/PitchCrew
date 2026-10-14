import { WorkspaceHeaderActions } from '@/App/components/WorkspacePage.tsx';
import { EmptyState } from '@/components/EmptyState/index.tsx';
import { InboxRequestList } from './components/InboxRequestList.tsx';
import { InboxReview } from './components/InboxReview.tsx';
import { InboxTabs } from './components/InboxTabs.tsx';
import { useInboxView } from './hooks/useInboxView.ts';
import type { InboxViewProps } from './types.ts';

export function InboxView(props: InboxViewProps) {
  const controller = useInboxView(props);
  const { tab, requests, selectedRequest, reviewOpen } = controller;
  return (
    <section
      className="inbox-workspace"
      data-review-open={reviewOpen}
      aria-label="Approval requests"
    >
      <WorkspaceHeaderActions>
        <InboxTabs {...controller} />
      </WorkspaceHeaderActions>
      {requests.length ? (
        <div className="inbox-review-layout">
          <InboxRequestList {...controller} />
          {selectedRequest ? <InboxReview {...controller} request={selectedRequest} /> : null}
        </div>
      ) : (
        <div className="inbox-empty">
          <EmptyState
            title={tab === 'pending' ? 'Nothing to approve' : 'No decisions yet'}
            description={
              tab === 'pending'
                ? 'Packet exports and browser actions appear here when they need your approval. Role and skill suggestions are reviewed in Chat → Crew work.'
                : 'Export decisions and completed or expired browser requests are kept here.'
            }
          />
        </div>
      )}
      <p className="inbox-boundary-note">
        Export approvals bind one exact packet. Browser approvals allow one exact interaction on the
        reviewed page and expire when the run ends.
      </p>
    </section>
  );
}
