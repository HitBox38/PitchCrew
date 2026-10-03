import type { SidebarMenuBadgeProps } from '@/components/ui/sidebar/types.ts';
import { cn } from '@/lib/utils';

export function SidebarMenuBadge({ className, ...props }: SidebarMenuBadgeProps) {
  return (
    <div
      data-slot="sidebar-menu-badge"
      data-sidebar="menu-badge"
      className={cn(
        'primitive:pointer-events-none primitive:absolute primitive:right-1 primitive:flex primitive:h-5 primitive:min-w-5 primitive:items-center primitive:justify-center primitive:rounded-md primitive:px-1 primitive:text-xs primitive:font-medium primitive:text-sidebar-foreground primitive:tabular-nums primitive:select-none',
        'primitive:peer-hover/menu-button:text-sidebar-accent-foreground primitive:peer-data-active/menu-button:text-sidebar-accent-foreground',
        'primitive:peer-data-[size=sm]/menu-button:top-1',
        'primitive:peer-data-[size=default]/menu-button:top-1.5',
        'primitive:peer-data-[size=lg]/menu-button:top-2.5',
        'primitive:group-data-[collapsible=icon]:hidden',
        className,
      )}
      {...props}
    />
  );
}
