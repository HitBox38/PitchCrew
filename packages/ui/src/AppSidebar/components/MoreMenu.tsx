import { useNavigate } from '@tanstack/react-router';
import { Ellipsis } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu/index.tsx';
import { SidebarMenuButton } from '@/components/ui/sidebar/components/SidebarMenuButton.tsx';
import { SidebarMenuItem } from '@/components/ui/sidebar/components/SidebarMenuItem.tsx';
import { useSidebar } from '@/components/ui/sidebar/hooks/useSidebar.ts';
import { viewPaths } from '@/navigation.ts';
import type { WorkspaceLinksProps } from '../types.ts';
import { moreViews, viewIcons, viewTitles } from '../constants.ts';

/**
 * One row for the secondary pages. While one of them is open the row is selected and named after
 * it.
 */
export const MoreMenu = ({ view, counts }: WorkspaceLinksProps) => {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const navigate = useNavigate();
  const current = moreViews.find((id) => id === view);
  const Icon = current ? viewIcons[current] : Ellipsis;
  const name = current ? viewTitles[current] : 'More';
  const skills = counts.skills ?? 0;
  const updates = `${skills} skill update${skills === 1 ? '' : 's'}`;
  const label = current ? `More, ${name}` : skills ? `More pages, ${updates}` : 'More pages';
  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarMenuButton
              tooltip={current ? `More, ${name}` : skills ? `More, ${updates}` : 'More'}
              aria-label={label}
              isActive={!!current}
              className="sidebar-nav-row sidebar-more"
            />
          }
        >
          <Icon aria-hidden="true" />
          <span>{name}</span>
          {skills && !current ? <span className="sidebar-more-dot" aria-hidden="true" /> : null}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="sidebar-more-menu min-w-52"
          side={state === 'collapsed' && !isMobile ? 'right' : 'bottom'}
          align="start"
        >
          <DropdownMenuGroup>
            {moreViews.map((id) => {
              const ItemIcon = viewIcons[id];
              return (
                <DropdownMenuItem
                  key={id}
                  onClick={() => {
                    setOpenMobile(false);
                    void navigate({ to: viewPaths[id] });
                  }}
                >
                  <ItemIcon aria-hidden="true" /> {viewTitles[id]}
                  {id === 'skills' && skills ? (
                    <DropdownMenuShortcut aria-label={updates}>{skills}</DropdownMenuShortcut>
                  ) : null}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
};
