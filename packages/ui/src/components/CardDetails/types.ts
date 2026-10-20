import type { useCardDetails } from './hooks/useCardDetails.ts';
import type { Action } from '@/WorkspaceStore/index.ts';
import type { Card, Run, Snapshot } from '@pitchcrew/core';

export type JobSection = 'job' | 'application' | 'activity';
export type ApplicationSection = 'brief' | 'documents' | 'reviews' | 'export';
export interface CardDetailsProps {
  card: Card;
  data: Snapshot;
  action: Action;
  working: boolean;
  initialSection?: JobSection;
  onClose: () => void;
  onInbox: () => void;
  onChat: (thread: string, runId: string) => void;
}
export type CardDetailsModel = ReturnType<typeof useCardDetails>;
export type JobActionsProps = CardDetailsModel;
export type JobHeadingProps = Pick<CardDetailsModel, 'card'>;
export type JobMetadataProps = Pick<CardDetailsModel, 'card'>;
export type JobHistoryProps = Pick<CardDetailsModel, 'data' | 'card'>;
export type JobStateProps = Pick<CardDetailsModel, 'card'>;
export type JobOverviewProps = Pick<CardDetailsModel, 'card' | 'working' | 'run' | 'act'>;
export type JobPacketProps = Pick<CardDetailsModel, 'document' | 'setDocument' | 'card'>;
export type JobTabsProps = CardDetailsModel;
export type OutcomeActionsProps = JobOverviewProps;
export type PacketDocumentPickerProps = Pick<CardDetailsModel, 'document' | 'setDocument'>;
export type JobAgent = { run: Run; name: string };
