import { WorkspaceHeaderActions } from '@/App/components/WorkspacePage.tsx';
import { InboxRequestList } from './components/InboxRequestList.tsx';
import { InboxReview } from './components/InboxReview.tsx';
import { InboxTabs } from './components/InboxTabs.tsx';
import { useInboxView } from './hooks/useInboxView.ts';
import type { InboxViewProps } from './types.ts';
import '@/styles/inbox.css';

export const InboxView = (props: InboxViewProps) => {
  const controller = useInboxView(props);
  return (
    <section className="inbox-workspace email-inbox" aria-label="Inbox requests">
      <WorkspaceHeaderActions>
        <InboxTabs {...controller} />
      </WorkspaceHeaderActions>
      {controller.selectedRequest ? (
        <InboxReview {...controller} request={controller.selectedRequest} />
      ) : (
        <InboxRequestList {...controller} />
      )}
    </section>
  );
};
