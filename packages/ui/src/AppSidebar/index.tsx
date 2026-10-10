import { CrewLinks } from '@/AppSidebar/components/CrewLinks.tsx';
import { SettingsLink } from '@/AppSidebar/components/SettingsLink.tsx';
import { RecentJobs } from '@/AppSidebar/components/RecentJobs.tsx';
import { SidebarHeading } from '@/AppSidebar/components/SidebarHeading.tsx';
import { WorkspaceLinks } from '@/AppSidebar/components/WorkspaceLinks.tsx';
import type { AppSidebarProps } from '@/AppSidebar/types.ts';
import { Sidebar } from '@/components/ui/sidebar/components/Sidebar.tsx';
import { SidebarContent } from '@/components/ui/sidebar/components/SidebarContent.tsx';
import { SidebarRail } from '@/components/ui/sidebar/components/SidebarRail.tsx';
import { ConversationNavigation } from '@/ConversationNavigation/index.tsx';

export function AppSidebar(props: AppSidebarProps) {
  const { recent } = props;
  return (
    <Sidebar collapsible="icon" aria-label="Sidebar">
      <SidebarHeading {...props} />
      <SidebarContent>
        <WorkspaceLinks {...props} />
        <ConversationNavigation data={props.data} />
        <CrewLinks {...props} />
        {recent.length ? <RecentJobs {...props} /> : null}
      </SidebarContent>
      <SettingsLink active={props.view === 'settings'} />
      <SidebarRail />
    </Sidebar>
  );
}
