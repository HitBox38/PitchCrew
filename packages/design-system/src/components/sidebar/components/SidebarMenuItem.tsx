import type { SidebarMenuItemProps } from '../types.ts';
import { cn } from '../../../lib/utils.ts';
import { menuItemPresence } from '../presence.ts';

export const SidebarMenuItem = ({ className, ...props }: SidebarMenuItemProps) => {
  const { Provider, register, attributes } = menuItemPresence.useRoot();
  return (
    <Provider value={register}>
      <li
        data-slot="sidebar-menu-item"
        data-sidebar="menu-item"
        {...attributes}
        className={cn('group/menu-item primitive:relative', className)}
        {...props}
      />
    </Provider>
  );
};
