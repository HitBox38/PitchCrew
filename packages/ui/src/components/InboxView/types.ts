import type { useInboxView } from '@/components/InboxView/hooks/useInboxView.ts';
import type { Action } from '@/WorkspaceStore/index.ts';
import type { Approval, Card, ComputerApproval, Snapshot } from '@pitchcrew/core';

export interface InboxViewProps {
  data: Snapshot;
  action: Action;
  working: boolean;
  onOpen: (id: string) => void;
  /** URL-backed key of the past decision being read. */
  selected: string | undefined;
  select: (key: string | null) => void;
}
export type InboxTab = 'pending' | 'history';
export type HistoryFilter = 'all' | 'packet' | 'browser';
export type ApprovalRequest =
  | { kind: 'packet'; key: string; approval: Approval }
  | { kind: 'browser'; key: string; approval: ComputerApproval };
export type InboxViewModel = NonNullable<ReturnType<typeof useInboxView>>;

/** What every approval surface needs, whether it sits on Decisions or in history. */
type ApprovalContext = Pick<InboxViewProps, 'data' | 'action' | 'working' | 'onOpen'> & {
  act: (path: string, body?: unknown, success?: string) => void;
};

export type BrowserApprovalListProps = Pick<InboxViewProps, 'action' | 'working'> & {
  computerApprovals: ComputerApproval[];
};

export type PacketApprovalActionsProps = ApprovalContext & {
  approval: Approval;
  card: Card;
};

export type PacketApprovalListProps = ApprovalContext & { approvals: Approval[] };

export type HistorySheetProps = InboxViewModel & { request: ApprovalRequest };
