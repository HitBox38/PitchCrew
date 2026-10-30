import type { AppSidebarProps } from '@/AppSidebar/types.ts';
import { SettingsLink } from '@/AppSidebar/components/SettingsLink.tsx';
import { SidebarHeading } from '@/AppSidebar/components/SidebarHeading.tsx';
import { Sidebar } from '@/components/ui/sidebar/components/Sidebar.tsx';
import { SidebarContent } from '@/components/ui/sidebar/components/SidebarContent.tsx';
import { SidebarRail } from '@/components/ui/sidebar/components/SidebarRail.tsx';
import { ConversationNavigation } from '@/ConversationNavigation/index.tsx';
import { ClayJobs } from './ClayJobs.tsx';
import { ClayMore, ClayNav } from './ClayNav.tsx';

/** Sidebar for the clay preview: four places, live jobs, then conversations. */
export const ClaySidebar = (props: AppSidebarProps) => (
  <Sidebar collapsible="icon" aria-label="Sidebar" className="clay-sidebar">
    <SidebarHeading {...props} />
    <SidebarContent>
      <ClayNav view={props.view} counts={props.counts} />
      <ClayJobs data={props.data} onOpenCard={props.onOpenCard} />
      <ConversationNavigation data={props.data} />
      <ClayMore view={props.view} counts={props.counts} />
    </SidebarContent>
    <SettingsLink active={props.view === 'settings'} />
    <SidebarRail />
  </Sidebar>
);
