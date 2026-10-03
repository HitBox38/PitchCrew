import { EmptyState } from '@/components/EmptyState/index.tsx';
import { BrowserApprovalList } from '@/components/InboxView/components/BrowserApprovalList.tsx';
import { InboxTabs } from '@/components/InboxView/components/InboxTabs.tsx';
import { PacketApprovalList } from '@/components/InboxView/components/PacketApprovalList.tsx';
import { useInboxView } from '@/components/InboxView/hooks/useInboxView.ts';
import type { InboxViewProps } from '@/components/InboxView/types.ts';

export function InboxView(props: InboxViewProps) {
  const controller = useInboxView(props);
  const { tab, approvals, computerApprovals } = controller;
  return (
    <>
      <InboxTabs {...controller} />
      <BrowserApprovalList key={`browser-${tab}`} {...controller} />
      <PacketApprovalList key={`packet-${tab}`} {...controller} />
      {!approvals.length && !computerApprovals.length ? (
        <EmptyState
          title={tab === 'pending' ? 'Nothing to approve' : 'No decisions yet'}
          description={
            tab === 'pending'
              ? 'Packet exports and browser actions appear here when they need your approval. Role and skill suggestions are reviewed in Chat → Crew work.'
              : 'Export decisions and completed or expired browser requests are kept here.'
          }
        />
      ) : null}
      <p className="info-note">
        Export approvals bind one exact packet. Browser approvals allow one exact interaction on the
        reviewed page and expire when the run ends.
      </p>
    </>
  );
}
