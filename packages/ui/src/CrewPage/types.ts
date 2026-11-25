import type { InstructionUpdate, Role, Run, RuntimeId } from '@pitchcrew/core';

export interface CapabilityLine {
  icon: 'browser' | 'draft' | 'review' | 'fit' | 'mail' | 'crew' | 'notes' | 'chat';
  label: string;
}

/**
 * What an agent is doing, in the order a person needs to know it: a question, then a browser
 * request on one of its live runs, then live work, then setup or idle. `busy` is true while any of
 * its runs is running, review-seat reservations included, since the server refuses settings changes
 * then. `also` names the one other job it runs, when there is exactly one.
 */
export type CrewStatus = (
  | {
      kind: 'working';
      run: Run;
      subject: string;
      elapsed: string;
      phase: string;
      /** Other live runs beside this one. */
      more: number;
      also?: string;
    }
  | {
      kind: 'approving';
      run: Run;
      approvalId: string;
      subject: string;
      since: string;
      /** Live runs beside the one that waits for the user's OK. */
      alsoRunning: number;
      also?: string;
    }
  | {
      kind: 'waiting';
      subject: string;
      threadId: string;
      since: string;
      /** Live runs while the question waits. */
      alsoRunning: number;
      also?: string;
    }
  | {
      kind: 'paused';
      cause?: { text: string; section: 'runtimes' | 'accounts'; runtime?: RuntimeId };
    }
  | { kind: 'unavailable' | 'signin'; runtime: RuntimeId; runtimeName: string }
  | { kind: 'idle'; fact: string }
) & { busy: boolean };

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
