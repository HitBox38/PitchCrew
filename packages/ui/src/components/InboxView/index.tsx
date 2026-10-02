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
      {computerApprovals.length ? <BrowserApprovalList {...controller} /> : null}
      {approvals.length ? (
        <PacketApprovalList {...controller} />
      ) : !computerApprovals.length ? (
        <EmptyState
          title={tab === 'pending' ? 'Nothing to approve' : 'No decisions yet'}
          description={
            tab === 'pending'
              ? 'When Reviewer agrees on a packet, request approval from the job’s card.'
              : 'Approved exports and rejections are kept here.'
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
