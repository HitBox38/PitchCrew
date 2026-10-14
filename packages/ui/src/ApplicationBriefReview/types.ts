import type { Card, ExtractedJob, Role } from '@pitchcrew/core';
export interface ApplicationBriefProps {
  card: Card;
  roles: Role[];
  busy: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}
export interface ContextResponse {
  sourceRevision: string;
  context: Card['applicationContext'] | null;
  flagged: ExtractedJob['flagged'];
}
