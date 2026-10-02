import type { Role } from '@pitchcrew/core';

export interface CrewCardProps {
  role: Role;
  status: string;
  onConfigure: () => void;
  onChat: () => void;
}
