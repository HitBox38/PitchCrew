import { useSidebar } from '@/components/ui/sidebar/hooks/useSidebar.ts';
import type { SidebarRailProps } from '@/components/ui/sidebar/types.ts';
import { cn } from '@/lib/utils';

export function SidebarRail({ className, ...props }: SidebarRailProps) {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      data-sidebar="rail"
      data-slot="sidebar-rail"
      aria-label="Toggle Sidebar"
      tabIndex={-1}
      onClick={toggleSidebar}
      title="Toggle Sidebar"
      className={cn(
        'primitive:absolute primitive:inset-y-0 primitive:z-20 primitive:hidden primitive:w-4 primitive:-translate-x-1/2 primitive:transition-all primitive:ease-linear primitive:group-data-[side=left]:-right-4 primitive:group-data-[side=right]:left-0 primitive:after:absolute primitive:after:inset-y-0 primitive:after:left-1/2 primitive:after:w-[2px] primitive:hover:after:bg-sidebar-border primitive:sm:flex',
        'primitive:in-data-[side=left]:cursor-w-resize primitive:in-data-[side=right]:cursor-e-resize',
        'primitive:[[data-side=left][data-state=collapsed]_&]:cursor-e-resize primitive:[[data-side=right][data-state=collapsed]_&]:cursor-w-resize',
        'primitive:group-data-[collapsible=offcanvas]:translate-x-0 primitive:group-data-[collapsible=offcanvas]:after:left-full primitive:hover:group-data-[collapsible=offcanvas]:bg-sidebar',
        'primitive:[[data-side=left][data-collapsible=offcanvas]_&]:-right-2',
        'primitive:[[data-side=right][data-collapsible=offcanvas]_&]:-left-2',
        className,
      )}
      {...props}
    />
  );
}
