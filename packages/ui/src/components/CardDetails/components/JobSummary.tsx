import { JobHeading } from './JobHeading.tsx';
import { JobState } from './JobState.tsx';
import { JobAgents } from './JobAgents.tsx';
import type { CardDetailsModel } from '../types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { ExternalLink, Pencil, X } from 'lucide-react';

type JobSummaryProps = Pick<CardDetailsModel, 'card' | 'onClose'> &
  Partial<Pick<CardDetailsModel, 'agents' | 'openChat' | 'editBlocker' | 'setEditing'>>;

export const JobSummary = ({
  card,
  onClose,
  agents,
  openChat,
  editBlocker,
  setEditing,
}: JobSummaryProps) => {
  return (
    <header className="job-summary shrink-0 px-5 pt-5 pb-3 max-mobile:px-4">
      <div className="flex items-start justify-between gap-3">
        <JobHeading card={card} />
        <div className="flex shrink-0 items-center gap-1">
          {setEditing ? (
            <Button
              variant="ghost"
              className="icon-button"
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
              className="icon-button"
              render={
                <a aria-label="Open job posting" href={card.url} target="_blank" rel="noreferrer" />
              }
              aria-label="Open job posting"
            >
              <ExternalLink size={16} />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={20} />
          </Button>
        </div>
      </div>
      <div className="detail-meta">
        <span>{card.location || 'Location not given'}</span>
        {card.salary ? <span>{card.salary}</span> : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <JobState card={card} />
        {agents && openChat ? <JobAgents agents={agents} openChat={openChat} /> : null}
      </div>
    </header>
  );
};
