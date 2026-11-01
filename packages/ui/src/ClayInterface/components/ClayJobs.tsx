import { Link } from '@tanstack/react-router';
import { Briefcase } from 'lucide-react';
import { SidebarCategory } from '@/AppSidebar/components/SidebarCategory.tsx';
import { RailShortcut } from '@/AppSidebar/components/RailShortcut.tsx';
import {
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@pitchcrew/design-system/sidebar';
import type { ClaySidebarState } from '../hooks/useClaySidebar.ts';
import { ClayJobRow } from './ClayJobRow.tsx';

type ClayJobsProps = { sidebar: ClaySidebarState; onOpenCard: (id: string) => void };

/** Live jobs, each with its conversations folded beneath it, then one row counting the leads. */
export const ClayJobs = ({ sidebar, onOpenCard }: ClayJobsProps) => {
  const { jobs, leads, nested, navigation, actions } = sidebar;
  if (!jobs.length && !leads.length) return null;
  if (navigation.iconOnly)
    return <RailShortcut id="clay-jobs" label="Open jobs" icon={<Briefcase />} />;
  const best = leads.reduce<(typeof leads)[number] | undefined>(
    (top, card) => (card.fit !== null && (top?.fit ?? -1) < card.fit ? card : top),
    undefined,
  );
  return (
    <SidebarCategory id="clay-jobs" label="Jobs" className="clay-jobs">
      <SidebarGroupContent>
        <SidebarMenu>
          {jobs.map((job) => (
            <ClayJobRow
              key={job.card.id}
              job={job}
              rows={nested.byCard.get(job.card.id) ?? []}
              open={sidebar.isOpen(job.card.id)}
              setOpen={(open) => sidebar.setJobOpen(job.card.id, open)}
              onOpenCard={onOpenCard}
              thread={navigation.thread}
              now={sidebar.now}
              closeMobile={navigation.closeMobile}
              actions={actions}
              working={actions.working}
            />
          ))}
          {leads.length ? (
            <SidebarMenuItem>
              <SidebarMenuButton
                className="clay-job-row clay-job-leads"
                render={<Link to="/" onClick={navigation.closeMobile} />}
              >
                <span className="clay-bead" data-size="sm" data-empty="" aria-hidden="true" />
                <span className="clay-job-company">
                  {leads.length} {leads.length === 1 ? 'lead' : 'leads'}
                </span>
                {best ? (
                  <span className="clay-job-best">
                    <span className="sr-only">, best fit </span>
                    {best.company} {best.fit}
                  </span>
                ) : null}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarCategory>
  );
};
