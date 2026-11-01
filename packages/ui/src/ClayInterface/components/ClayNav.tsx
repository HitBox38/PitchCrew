import { Link } from '@tanstack/react-router';
import type { WorkspaceLinksProps } from '@/AppSidebar/types.ts';
import { primaryShortcutViews, viewIcons, viewTitles } from '@/AppSidebar/constants.ts';
import { countedLabel } from '@/AppSidebar/helpers.ts';
import { MoreMenu } from '@/AppSidebar/components/MoreMenu.tsx';
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@pitchcrew/design-system/sidebar';
import { viewPaths } from '@/navigation.ts';
import { isMac } from '@/shortcuts.ts';

/** What each count means, for its accessible name and tone. */
const countMeaning = {
  board: { noun: '', tone: '' },
  inbox: { noun: 'waiting on you', tone: 'ochre' },
  crew: { noun: 'updates or proposals', tone: 'plum' },
  profile: { noun: 'proposals to review', tone: 'ochre' },
} as const;

/**
 * Board, Decisions, Crew and Profile with ⌘1–4, then More for the secondary pages. A count
 * replaces the shortcut hint while something is waiting.
 */
export const ClayNav = ({ view, counts }: WorkspaceLinksProps) => (
  <SidebarGroup className="sidebar-nav">
    <SidebarMenu>
      {primaryShortcutViews.map((id, index) => {
        const Icon = viewIcons[id];
        const count = counts[id] ?? 0;
        const { noun, tone } = countMeaning[id];
        const label = countedLabel(viewTitles[id], count, noun);
        return (
          <SidebarMenuItem key={id}>
            <SidebarMenuButton
              data-replay-surface={id}
              tooltip={label}
              aria-label={label}
              isActive={view === id}
              aria-current={view === id ? 'page' : undefined}
              className="sidebar-nav-row"
              render={<Link to={viewPaths[id]} />}
            >
              <Icon aria-hidden="true" />
              <span>{viewTitles[id]}</span>
            </SidebarMenuButton>
            {count ? (
              <SidebarMenuBadge className="sidebar-count" data-tone={tone}>
                {count}
              </SidebarMenuBadge>
            ) : (
              <SidebarMenuBadge className="sidebar-shortcut" aria-hidden="true">
                {isMac ? '⌘' : 'Ctrl+'}
                {index + 1}
              </SidebarMenuBadge>
            )}
          </SidebarMenuItem>
        );
      })}
      <MoreMenu view={view} counts={counts} />
    </SidebarMenu>
  </SidebarGroup>
);
