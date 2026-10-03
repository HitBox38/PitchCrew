import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import type { RoleSettingsHeadingProps } from '@/components/RoleSettings/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { SheetDescription } from '@/components/ui/sheet/components/SheetDescription.tsx';
import { SheetTitle } from '@/components/ui/sheet/components/SheetTitle.tsx';
import { X } from 'lucide-react';

export function RoleSettingsHeading({ role, onClose }: RoleSettingsHeadingProps) {
  return (
    <header className="role-settings-heading">
      <RoleAvatar agentRole={role.id} size="large" />
      <div>
        <SheetTitle>{role.name ? `${role.name} settings` : 'Create role'}</SheetTitle>
        <SheetDescription>{role.description}</SheetDescription>
      </div>
      <Button
        variant="ghost"
        className="icon-button"
        onClick={onClose}
        aria-label="Close agent settings"
      >
        <X size={20} />
      </Button>
    </header>
  );
}
