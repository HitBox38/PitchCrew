import type { useInboxView } from '@/components/InboxView/hooks/useInboxView.ts';
import type { Action } from '@/WorkspaceStore/index.ts';
import type { Approval, Card, ComputerApproval, Snapshot } from '@pitchcrew/core';

export interface InboxViewProps {
  data: Snapshot;
  action: Action;
  working: boolean;
  onOpen: (id: string) => void;
}
export type InboxTab = 'pending' | 'history';
export type ApprovalRequest =
  | { kind: 'packet'; key: string; approval: Approval }
  | { kind: 'browser'; key: string; approval: ComputerApproval };
export type InboxViewModel = NonNullable<ReturnType<typeof useInboxView>>;

export type BrowserApprovalListProps = Pick<InboxViewModel, 'action' | 'working'> & {
  computerApprovals: ComputerApproval[];
};

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
  'data' | 'onOpen' | 'working' | 'act' | 'action'
> & { approvals: Approval[] };

export type PacketPreviewProps = { approval: Approval };

export type InboxRequestListProps = Pick<
  InboxViewModel,
  'requests' | 'selectedRequest' | 'selectRequest' | 'data' | 'tab' | 'reviewOpen'
>;
export type InboxReviewProps = InboxViewModel & { request: ApprovalRequest };
