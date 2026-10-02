import type { SidebarMenuItemProps } from '@/components/ui/sidebar/types.ts';
import { cn } from '@/lib/utils';

export function SidebarMenuItem({ className, ...props }: SidebarMenuItemProps) {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn('group/menu-item relative', className)}
      {...props}
    />
  );
}
