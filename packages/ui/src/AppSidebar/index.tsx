import { CrewLinks } from '@/AppSidebar/components/CrewLinks.tsx';
import { DevicePreferences } from '@/AppSidebar/components/DevicePreferences.tsx';
import { RecentJobs } from '@/AppSidebar/components/RecentJobs.tsx';
import { SidebarHeading } from '@/AppSidebar/components/SidebarHeading.tsx';
import { WorkspaceLinks } from '@/AppSidebar/components/WorkspaceLinks.tsx';
import { getSidebarModel } from '@/AppSidebar/helpers.ts';
import type { AppSidebarProps } from '@/AppSidebar/types.ts';
import { Sidebar } from '@/components/ui/sidebar/components/Sidebar.tsx';
import { SidebarContent } from '@/components/ui/sidebar/components/SidebarContent.tsx';
import { SidebarRail } from '@/components/ui/sidebar/components/SidebarRail.tsx';

export function AppSidebar(props: AppSidebarProps) {
  const controller = getSidebarModel(props);
  const { recent } = controller;
  return (
    <Sidebar collapsible="icon" aria-label="Sidebar">
      <SidebarHeading {...controller} />
      <SidebarContent>
        <WorkspaceLinks {...controller} />
        <CrewLinks {...controller} />
        {recent.length ? <RecentJobs {...controller} /> : null}
      </SidebarContent>
      <DevicePreferences {...controller} />
      <SidebarRail />
    </Sidebar>
  );
}
