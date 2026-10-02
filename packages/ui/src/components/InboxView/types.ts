import type { useInboxView } from '@/components/InboxView/hooks/useInboxView.ts';
import type { Action } from '@/WorkspaceStore/index.ts';
import type { Approval, Card, Snapshot } from '@pitchcrew/core';

export interface InboxViewProps {
  data: Snapshot;
  action: Action;
  working: boolean;
  onOpen: (id: string) => void;
}
export type InboxViewModel = NonNullable<ReturnType<typeof useInboxView>>;

export type BrowserApprovalListProps = Pick<
  InboxViewModel,
  'computerApprovals' | 'action' | 'working'
>;

export type InboxTabsProps = Pick<InboxViewModel, 'tab' | 'setTab' | 'data'>;
export type PacketApprovalActionsProps = Pick<
  InboxViewModel,
  'onOpen' | 'working' | 'act' | 'action'
> & {
  approval: Approval;
  card: Card;
};

export type PacketApprovalListProps = Pick<
  InboxViewModel,
  'approvals' | 'data' | 'onOpen' | 'working' | 'act' | 'action'
>;

export type PacketPreviewProps = { approval: Approval };
