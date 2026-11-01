import { Sheet } from '../../sheet/components/Sheet.tsx';
import { SheetContent } from '../../sheet/components/SheetContent.tsx';
import { SheetDescription } from '../../sheet/components/SheetDescription.tsx';
import { SheetHeader } from '../../sheet/components/SheetHeader.tsx';
import { SheetTitle } from '../../sheet/components/SheetTitle.tsx';
import { SIDEBAR_WIDTH_MOBILE } from '../constants.ts';
import { useSidebar } from '../hooks/useSidebar.ts';
import type { MobileSidebarProps } from '../types.ts';
import * as React from 'react';

export const MobileSidebar = ({ side, children, ...props }: MobileSidebarProps) => {
  const { openMobile, setOpenMobile } = useSidebar();
  return (
    <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
      <SheetContent
        data-sidebar="sidebar"
        data-slot="sidebar"
        data-mobile="true"
        className="primitive:w-(--sidebar-width) primitive:bg-sidebar primitive:p-0 primitive:text-sidebar-foreground primitive:[&>button]:hidden"
        style={
          {
            '--sidebar-width': SIDEBAR_WIDTH_MOBILE,
          } as React.CSSProperties
        }
        side={side}
      >
        <SheetHeader className="primitive:sr-only">
          <SheetTitle>Sidebar</SheetTitle>
          <SheetDescription>Displays the mobile sidebar.</SheetDescription>
        </SheetHeader>
        <div className="primitive:flex primitive:h-full primitive:w-full primitive:flex-col">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
};
