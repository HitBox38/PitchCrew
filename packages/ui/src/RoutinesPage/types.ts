import type { Card, Role, Routine } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/types.ts';

export type Frequency =
  | 'once'
  | 'interval'
  | 'daily'
  | 'weekdays'
  | 'weekly'
  | 'monthly'
  | 'custom';
export interface RoutineDraft {
  name: string;
  roleId: Role['id'];
  content: string;
  cardId: string;
  startLocal: string;
  timezone: string;
  frequency: Frequency;
  interval: string;
  unit: 'minutes' | 'hours' | 'days' | 'weeks';
  cron: string;
  maxRuns: string;
  endLocal: string;
  enabled: boolean;
}
export interface EditorProps {
  routine: Routine | null;
  roles: Role[];
  cards: Card[];
  action: Action;
  working: boolean;
  onClose(): void;
}
export interface DraftFieldsProps {
  draft: RoutineDraft;
  change(patch: Partial<RoutineDraft>): void;
}
