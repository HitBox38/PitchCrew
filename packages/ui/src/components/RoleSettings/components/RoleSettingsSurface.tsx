import { SidePanel } from '@/components/SidePanel/index.tsx';
import { Sheet } from '@/components/ui/sheet/components/Sheet.tsx';
import { SheetContent } from '@/components/ui/sheet/components/SheetContent.tsx';
import type { ReactNode } from 'react';

export function RoleSettingsSurface({
  docked,
  onClose,
  children,
}: {
  docked?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (docked)
    return (
      <SidePanel className="role-settings-panel" onClose={onClose}>
        {children}
      </SidePanel>
    );
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="role-settings-panel" showCloseButton={false}>
        {children}
      </SheetContent>
    </Sheet>
  );
}
