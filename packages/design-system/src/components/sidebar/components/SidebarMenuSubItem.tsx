import type { SidebarMenuSubItemProps } from '../types.ts';
import { cn } from '../../../lib/utils.ts';

export const SidebarMenuSubItem = ({ className, ...props }: SidebarMenuSubItemProps) => {
  return (
    <li
      data-slot="sidebar-menu-sub-item"
      data-sidebar="menu-sub-item"
      className={cn('group/menu-sub-item primitive:relative', className)}
      {...props}
    />
  );
};
