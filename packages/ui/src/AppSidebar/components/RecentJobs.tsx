import type { Card } from '@pitchcrew/core';
import { CompanyMark } from '@/components/CompanyMark/index.tsx';
import { SidebarGroupContent } from '@/components/ui/sidebar/components/SidebarGroupContent.tsx';
import { SidebarMenu } from '@/components/ui/sidebar/components/SidebarMenu.tsx';
import { SidebarMenuButton } from '@/components/ui/sidebar/components/SidebarMenuButton.tsx';
import { SidebarMenuItem } from '@/components/ui/sidebar/components/SidebarMenuItem.tsx';
import { useSidebar } from '@/components/ui/sidebar/hooks/useSidebar.ts';
import { SidebarCategory } from './SidebarCategory.tsx';

/** The five most recently opened jobs, newest first; each opens its job details. */
export const RecentJobs = ({
  recent,
  onOpenCard,
}: {
  recent: Card[];
  onOpenCard: (id: string) => void;
}) => {
  const { state, isMobile, setOpenMobile } = useSidebar();
  if (!recent.length || (state === 'collapsed' && !isMobile)) return null;
  return (
    <SidebarCategory id="recent" label="Recent" className="sidebar-recent" defaultOpen={false}>
      <SidebarGroupContent>
        <SidebarMenu>
          {recent.map((card) => (
            <SidebarMenuItem key={card.id}>
              <SidebarMenuButton
                className="sidebar-recent-row"
                onClick={() => {
                  setOpenMobile(false);
                  onOpenCard(card.id);
                }}
              >
                <CompanyMark name={card.company} />
                <span className="sidebar-row-text">
                  {card.title}
                  <span className="sidebar-row-meta"> · {card.company}</span>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarCategory>
  );
};
