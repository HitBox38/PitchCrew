import { CapabilitySettings } from '@/components/RoleSettings/components/CapabilitySettings.tsx';
import { InstructionSettings } from '@/components/RoleSettings/components/InstructionSettings.tsx';
import { RoleSettingsFooter } from '@/components/RoleSettings/components/RoleSettingsFooter.tsx';
import { RoleSettingsHeading } from '@/components/RoleSettings/components/RoleSettingsHeading.tsx';
import { RoleSkills } from '@/components/RoleSettings/components/RoleSkills.tsx';
import { RuntimeSettings } from '@/components/RoleSettings/components/RuntimeSettings.tsx';
import { useRoleSettings } from '@/components/RoleSettings/hooks/useRoleSettings.ts';
import type { RoleSettingsProps } from '@/components/RoleSettings/types.ts';
import { Sheet } from '@/components/ui/sheet/components/Sheet.tsx';
import { SheetContent } from '@/components/ui/sheet/components/SheetContent.tsx';

export function RoleSettings(props: RoleSettingsProps) {
  const controller = useRoleSettings(props);
  const { onClose, save } = controller;
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="role-settings-panel" showCloseButton={false}>
        <RoleSettingsHeading {...controller} />
        <form className="form role-settings-form" onSubmit={(e) => void save(e)}>
          <div className="role-settings-body">
            <RuntimeSettings {...controller} />
            <InstructionSettings {...controller} />
            <CapabilitySettings {...controller} />
            <RoleSkills {...controller} />
          </div>
          <RoleSettingsFooter {...controller} />
        </form>
      </SheetContent>
    </Sheet>
  );
}
