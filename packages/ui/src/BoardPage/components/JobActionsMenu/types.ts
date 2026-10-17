import type { Card, CardState, Snapshot } from '@pitchcrew/core';

export interface JobMenuActions {
  moveJob: (id: string, state: CardState) => Promise<void>;
  requestDelete: (id: string) => void;
}

export interface JobActionsMenuProps extends JobMenuActions {
  card: Card;
  data: Snapshot;
  disabled: boolean;
  openCard: (id: string) => void;
}

export interface CrewShortcut {
  label: string;
  roleId?: string;
  runId?: string;
  draft?: boolean;
  needsBrief?: boolean;
  reason?: string;
}
