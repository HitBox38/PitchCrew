import type { RoleId } from '@pitchcrew/core';

export interface RoleAvatarProps {
  agentRole: RoleId;
  size?: 'normal' | 'small' | 'large';
}
