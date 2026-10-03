import type { SidebarMenuSubProps } from '@/components/ui/sidebar/types.ts';
import { cn } from '@/lib/utils';

export function SidebarMenuSub({ className, ...props }: SidebarMenuSubProps) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      data-sidebar="menu-sub"
      className={cn(
        'primitive:mx-3.5 primitive:flex primitive:min-w-0 primitive:translate-x-px primitive:flex-col primitive:gap-1 primitive:border-l primitive:border-sidebar-border primitive:px-2.5 primitive:py-0.5',
        'primitive:group-data-[collapsible=icon]:hidden',
        className,
      )}
      {...props}
    />
  );
}
