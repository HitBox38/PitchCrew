import type { InstructionUpdate, Role } from '@pitchcrew/core';

export interface CrewCardProps {
  role: Role;
  status: string;
  /** A newer default the user has not answered yet. */
  update?: InstructionUpdate;
  onConfigure: () => void;
  onChat: () => void;
}
