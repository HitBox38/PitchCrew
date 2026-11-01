import type { InstructionUpdate, Role, Run, RuntimeId } from '@pitchcrew/core';

export interface CapabilityLine {
  icon: 'browser' | 'draft' | 'review' | 'fit' | 'mail' | 'crew' | 'notes' | 'chat';
  label: string;
}

export type CrewStatus =
  | { kind: 'working'; run: Run; subject: string; elapsed: string; phase: string }
  | { kind: 'waiting'; subject: string; threadId: string }
  | {
      kind: 'paused';
      cause?: { text: string; section: 'runtimes' | 'accounts'; runtime?: RuntimeId };
    }
  | { kind: 'unavailable' | 'signin'; runtime: RuntimeId; runtimeName: string }
  | { kind: 'idle'; fact: string };

export interface CrewCardProps {
  role: Role;
  status: CrewStatus;
  /** A newer default the user has not answered yet. */
  update?: InstructionUpdate;
  now: number;
  working: boolean;
  onConfigure: () => void;
  onChat: () => void;
  onToggle: () => void;
  onReview: () => void;
}
