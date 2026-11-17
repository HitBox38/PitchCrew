import { JobHeading } from './JobHeading.tsx';
import { JobState } from './JobState.tsx';
import { JobAgents } from './JobAgents.tsx';
import type { CardDetailsModel } from '../types.ts';
import { JobProgress } from '@/ClayInterface/components/JobProgress.tsx';
import { Button } from '@pitchcrew/design-system/button';
import { ExternalLink, Pencil, X } from 'lucide-react';

type JobSummaryProps = Pick<CardDetailsModel, 'card' | 'onClose'> &
  Partial<Pick<CardDetailsModel, 'data' | 'agents' | 'openChat' | 'editBlocker' | 'setEditing'>>;

/** Identity on two rows, then one row for where the job stands: track, live agents, ratings. */
export const JobSummary = ({
  card,
  data,
  onClose,
  agents,
  openChat,
  editBlocker,
  setEditing,
}: JobSummaryProps) => {
  return (
    <header className="job-summary shrink-0">
      <div className="flex items-start justify-between gap-3">
        <JobHeading card={card} />
        <div className="detail-header-actions flex shrink-0 items-center gap-0.5">
          {setEditing ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Edit job"
              title={editBlocker || 'Edit job'}
              disabled={!!editBlocker}
              onClick={() => setEditing(true)}
            >
              <Pencil size={16} />
            </Button>
          ) : null}
          {card.url ? (
            <Button
              variant="ghost"
              nativeButton={false}
              size="icon-sm"
              render={
                <a aria-label="Open job posting" href={card.url} target="_blank" rel="noreferrer" />
              }
              aria-label="Open job posting"
            >
              <ExternalLink size={16} />
            </Button>
          ) : null}
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </Button>
        </div>
      </div>
      <div className="detail-progress">
        {data ? <JobProgress card={card} data={data} /> : null}
        {agents?.length && openChat ? <JobAgents agents={agents} openChat={openChat} /> : null}
        <JobState card={card} />
      </div>
    </header>
  );
};
