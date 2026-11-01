import type { SidebarMenuItemProps } from '../types.ts';
import { cn } from '../../../lib/utils.ts';

export const SidebarMenuItem = ({ className, ...props }: SidebarMenuItemProps) => {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn('group/menu-item primitive:relative', className)}
      {...props}
    />
  );
};
