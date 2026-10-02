import { Sheet } from '@/components/ui/sheet/components/Sheet.tsx';
import { SheetContent } from '@/components/ui/sheet/components/SheetContent.tsx';
import { SheetDescription } from '@/components/ui/sheet/components/SheetDescription.tsx';
import { SheetHeader } from '@/components/ui/sheet/components/SheetHeader.tsx';
import { SheetTitle } from '@/components/ui/sheet/components/SheetTitle.tsx';
import { SIDEBAR_WIDTH_MOBILE } from '@/components/ui/sidebar/constants.ts';
import { useSidebar } from '@/components/ui/sidebar/hooks/useSidebar.ts';
import type { MobileSidebarProps } from '@/components/ui/sidebar/types.ts';
import * as React from 'react';

export function MobileSidebar({ side, children, ...props }: MobileSidebarProps) {
  const { openMobile, setOpenMobile } = useSidebar();
  return (
    <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
      <SheetContent
        data-sidebar="sidebar"
        data-slot="sidebar"
        data-mobile="true"
        className="w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
        style={
          {
            '--sidebar-width': SIDEBAR_WIDTH_MOBILE,
          } as React.CSSProperties
        }
        side={side}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Sidebar</SheetTitle>
          <SheetDescription>Displays the mobile sidebar.</SheetDescription>
        </SheetHeader>
        <div className="flex h-full w-full flex-col">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
