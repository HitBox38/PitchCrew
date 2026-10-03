import type { SidebarMenuProps } from '@/components/ui/sidebar/types.ts';
import { cn } from '@/lib/utils';

export function SidebarMenu({ className, ...props }: SidebarMenuProps) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      className={cn(
        'primitive:flex primitive:w-full primitive:min-w-0 primitive:flex-col primitive:gap-1',
        className,
      )}
      {...props}
    />
  );
}
