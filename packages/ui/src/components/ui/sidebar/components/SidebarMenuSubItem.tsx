import type { SidebarMenuSubItemProps } from '@/components/ui/sidebar/types.ts';
import { cn } from '@/lib/utils';

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
