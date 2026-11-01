import type { ReactNode } from 'react';
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@pitchcrew/design-system/sidebar';
import { categoryKey } from '../hooks/useCategoryOpen.ts';

/**
 * In the collapsed rail a sidebar category becomes one icon that expands the sidebar with that
 * category open. The rail never changes the saved disclosure state otherwise.
 */
export const RailShortcut = ({
  id,
  label,
  icon,
}: {
  id: string;
  label: string;
  icon: ReactNode;
}) => {
  const { setOpen } = useSidebar();
  return (
    <SidebarGroup className="sidebar-rail-shortcut">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip={label}
            aria-label={label}
            onClick={() => {
              try {
                localStorage.setItem(categoryKey(id), 'true');
              } catch {
                /* Device preference is optional. */
              }
              setOpen(true);
            }}
          >
            {icon}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
};
