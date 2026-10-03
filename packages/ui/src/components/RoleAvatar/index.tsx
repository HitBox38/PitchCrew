import type { RoleAvatarProps } from '@/components/RoleAvatar/types.ts';
import { roleIcons } from '@/lib/labels.ts';
import { Bot } from 'lucide-react';

export function RoleAvatar({ agentRole, size = 'normal' }: RoleAvatarProps) {
  const Icon = roleIcons[agentRole as keyof typeof roleIcons] ?? Bot;
  return (
    <span className={`role-avatar ${agentRole} ${size}`}>
      <Icon size={size === 'small' ? 13 : size === 'large' ? 25 : 18} aria-hidden="true" />
    </span>
  );
}
