import { CompanyMark } from '@/components/CompanyMark/index.tsx';
import { JobCardSurface } from './components/JobCardSurface.tsx';
import type { JobCardProps } from '@/components/JobCard/types.ts';
import { JobWorkStatus } from '@/components/JobWorkStatus/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';

export const JobCard = (props: JobCardProps) => {
  const { card, onOpen, actions, buttonRef } = props;
  return (
    <JobCardSurface {...props}>
      <Button
        ref={buttonRef}
        className="job-card"
        onClick={onOpen}
        aria-label={`Open ${card.title} at ${card.company}`}
      >
        <div className="job-top flex items-center gap-2">
          <CompanyMark name={card.company} />
          <strong>{card.company}</strong>
          {card.sample ? <span className="sample-tag">example</span> : null}
        </div>
        <h3>{card.title}</h3>
        <p className="job-location">
          {card.location || 'Location not given'}
          {card.salary ? <span> · {card.salary}</span> : null}
        </p>
        {card.tags.length ? (
          <div className="tags mt-2.25 flex flex-wrap gap-1">
            {card.tags.slice(0, 3).map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        ) : null}
        <div className="job-bottom">
          {card.fit !== null ? (
            <span className={`fit ${card.fit >= 80 ? 'high' : ''}`}>
              <span className="fit-meter" aria-hidden="true">
                <span style={{ width: `${card.fit}%` }} />
              </span>
              {card.fit}% fit
            </span>
          ) : (
            <span className="subtle">Not scored</span>
          )}
          <JobWorkStatus card={card} />
        </div>
      </Button>
      {actions}
    </JobCardSurface>
  );
};
