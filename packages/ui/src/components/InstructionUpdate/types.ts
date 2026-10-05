import type { useInstructionUpdate } from './hooks/useInstructionUpdate.ts';
import type { Action } from '@/WorkspaceStore/index.ts';
import type { InstructionUpdate, Role } from '@pitchcrew/core';

export type DiffKind = 'same' | 'added' | 'removed';
export interface DiffSegment {
  kind: DiffKind;
  text: string;
}
export interface DiffLine extends DiffSegment {
  /** Word-level detail for a changed paragraph; absent when the whole line changed. */
  segments?: DiffSegment[];
}
export type ComparisonMode = 'yours' | 'default';

export interface InstructionUpdateProps {
  role: Role;
  update: InstructionUpdate;
  action: Action;
  working: boolean;
  /** The editor's unsaved instruction text. */
  instructions: string;
  setInstructions: (value: string) => void;
}
export type InstructionUpdateModel = ReturnType<typeof useInstructionUpdate>;
