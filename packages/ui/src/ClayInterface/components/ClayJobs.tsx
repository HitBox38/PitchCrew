import { Link } from '@tanstack/react-router';
import type { Snapshot } from '@pitchcrew/core';
import { SidebarCategory } from '@/AppSidebar/components/SidebarCategory.tsx';
import { SidebarGroupContent } from '@/components/ui/sidebar/components/SidebarGroupContent.tsx';
import { SidebarMenu } from '@/components/ui/sidebar/components/SidebarMenu.tsx';
import { SidebarMenuButton } from '@/components/ui/sidebar/components/SidebarMenuButton.tsx';
import { SidebarMenuItem } from '@/components/ui/sidebar/components/SidebarMenuItem.tsx';
import { stateTone } from '../helpers.ts';
import { sidebarJobs } from '../jobs.ts';
import { JobBead } from './JobBead.tsx';

type ClayJobsProps = { data: Snapshot; onOpenCard: (id: string) => void };

export const ClayJobs = ({ data, onOpenCard }: ClayJobsProps) => {
  const { jobs, leads } = sidebarJobs(data);
  if (!jobs.length && !leads.length) return null;
  return (
    <SidebarCategory id="clay-jobs" label="Jobs" className="clay-jobs">
      <SidebarGroupContent>
        <SidebarMenu>
          {jobs.map(({ card, signal, status }) => (
            <SidebarMenuItem key={card.id}>
              <SidebarMenuButton
                tooltip={`${card.company}: ${status}`}
                onClick={() => onOpenCard(card.id)}
                className="clay-job-row"
                data-asks={signal.decision ? '' : undefined}
              >
                <JobBead tone={stateTone(card.state)} signal={signal} />
                <span className="clay-job-company">{card.company}</span>
                <span className="clay-job-status">{status}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          {leads.length ? (
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={`${leads.length} leads`}
                className="clay-job-row clay-job-leads"
                render={<Link to="/" />}
              >
                <span className="clay-bead" data-size="sm" aria-hidden="true" />
                <span className="clay-job-company">
                  {leads.length} {leads.length === 1 ? 'lead' : 'leads'}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarCategory>
  );
};
