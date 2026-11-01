import type { AppSidebarProps } from '@/AppSidebar/types.ts';
import { CrewRoles } from '@/AppSidebar/components/CrewRoles.tsx';
import { RecentJobs } from '@/AppSidebar/components/RecentJobs.tsx';
import { SidebarFooterTray } from '@/AppSidebar/components/SidebarFooterTray.tsx';
import { SidebarStrip } from '@/AppSidebar/components/SidebarStrip.tsx';
import { Sidebar, SidebarContent, SidebarRail } from '@pitchcrew/design-system/sidebar';
import { ConversationNavigationView } from '@/ConversationNavigation/components/ConversationNavigationView.tsx';
import { useClaySidebar } from '../hooks/useClaySidebar.ts';
import { ClayJobs } from './ClayJobs.tsx';
import { ClayNav } from './ClayNav.tsx';

/**
 * The app sidebar on the paper: the top strip, four places and More, live jobs with their
 * conversations nested beneath, the remaining chats, recently opened jobs and the crew, then the
 * footer with setup, source activity, updates, the slot tray and Settings.
 */
export const ClaySidebar = (props: AppSidebarProps) => {
  const sidebar = useClaySidebar(props.data);
  return (
    <Sidebar collapsible="icon" aria-label="Pitchcrew" className="clay-sidebar">
      <SidebarStrip onSearch={props.onSearch} onAddJob={props.onAddJob} />
      <SidebarContent className="sidebar-scroll">
        <ClayNav view={props.view} counts={props.counts} />
        <ClayJobs sidebar={sidebar} onOpenCard={props.onOpenCard} />
        <ConversationNavigationView
          navigation={sidebar.navigation}
          actions={sidebar.actions}
          rows={sidebar.nested.rest}
          empty={sidebar.nested.byCard.size ? 'Job chats are listed under their jobs.' : undefined}
        />
        <RecentJobs recent={props.recent} onOpenCard={props.onOpenCard} />
        <CrewRoles
          data={props.data}
          working={props.working}
          onConfigureRole={props.onConfigureRole}
          onToggleRole={props.onToggleRole}
        />
      </SidebarContent>
      <SidebarFooterTray data={props.data} active={props.view === 'settings'} />
      <SidebarRail />
    </Sidebar>
  );
};
