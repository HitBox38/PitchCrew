import type { RecentJobsProps } from '@/AppSidebar/types.ts';
import { SidebarCategory } from '@/AppSidebar/components/SidebarCategory.tsx';
import { CompanyMark } from '@/components/CompanyMark/index.tsx';
import { SidebarGroupContent } from '@/components/ui/sidebar/components/SidebarGroupContent.tsx';
import { SidebarMenu } from '@/components/ui/sidebar/components/SidebarMenu.tsx';
import { SidebarMenuButton } from '@/components/ui/sidebar/components/SidebarMenuButton.tsx';
import { SidebarMenuItem } from '@/components/ui/sidebar/components/SidebarMenuItem.tsx';

export function RecentJobs({ recent, onOpenCard }: RecentJobsProps) {
  return (
    <SidebarCategory id="recent" label="Recently opened" className="recent-group">
      <SidebarGroupContent>
        <SidebarMenu>
          {recent.map((card) => (
            <SidebarMenuItem key={card.id}>
              <SidebarMenuButton
                tooltip={`${card.title} at ${card.company}`}
                onClick={() => onOpenCard(card.id)}
              >
                <CompanyMark name={card.company} />
                <span className="recent-text">
                  {card.title}
                  <small> · {card.company}</small>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarCategory>
  );
}
