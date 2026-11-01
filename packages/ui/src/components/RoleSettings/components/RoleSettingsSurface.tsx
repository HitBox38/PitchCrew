import { SidePanel } from '@/components/SidePanel/index.tsx';
import { Sheet, SheetContent } from '@pitchcrew/design-system/sheet';
import type { ReactNode } from 'react';

/** 480px agent panel: docked beside a chat, or an overlay sheet from Crew and elsewhere. */
export const RoleSettingsSurface = ({
  docked,
  onClose,
  children,
}: {
  docked?: boolean;
  onClose: () => void;
  children: ReactNode;
}) => {
  if (docked)
    return (
      <SidePanel className="agent-panel" onClose={onClose}>
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
      <SheetContent className="agent-panel" showCloseButton={false}>
        {children}
      </SheetContent>
    </Sheet>
  );
};
