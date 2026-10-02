import type { useCardDetails } from '@/components/CardDetails/hooks/useCardDetails.ts';
import type { Action } from '@/WorkspaceStore/index.ts';
import type { Card, Snapshot } from '@pitchcrew/core';

export interface CardDetailsProps {
  card: Card;
  data: Snapshot;
  action: Action;
  working: boolean;
  onClose: () => void;
  onInbox: () => void;
}
export type CardDetailsModel = NonNullable<ReturnType<typeof useCardDetails>>;

export type JobActionsProps = Pick<
  CardDetailsModel,
  'run' | 'act' | 'runRole' | 'working' | 'card' | 'exported' | 'onInbox'
>;

export type JobHeadingProps = Pick<CardDetailsModel, 'card'>;

export type JobHistoryProps = Pick<CardDetailsModel, 'data' | 'card'>;

export type JobMetadataProps = Pick<CardDetailsModel, 'card'>;

export type JobOverviewProps = Pick<CardDetailsModel, 'card' | 'working' | 'run' | 'act'>;

export type JobPacketProps = Pick<CardDetailsModel, 'document' | 'setDocument' | 'card'>;

export type JobStateProps = Pick<CardDetailsModel, 'card'>;

export type JobTabsProps = Pick<
  CardDetailsModel,
  'tab' | 'card' | 'working' | 'run' | 'act' | 'document' | 'setDocument' | 'data'
>;

export type OutcomeActionsProps = Pick<CardDetailsModel, 'card' | 'working' | 'run' | 'act'>;

export type PacketDocumentPickerProps = Pick<CardDetailsModel, 'document' | 'setDocument'>;
