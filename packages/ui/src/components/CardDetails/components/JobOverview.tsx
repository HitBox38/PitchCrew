import { JobMetadata } from './JobMetadata.tsx';
import type { JobOverviewProps } from '../types.ts';
import { AccordionSection } from '@/components/ui/accordion/components/AccordionSection.tsx';

export function JobOverview({ card }: JobOverviewProps) {
  return (
    <div className="detail-job space-y-6">
      {card.tags.length ? (
        <div className="tags flex flex-wrap gap-1">
          {card.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}
      <section>
        <h3>About the role</h3>
        <p className="prewrap break-words">
          {card.description || 'No description was added. Open the original posting for details.'}
        </p>
      </section>
      {card.feedback.length ? (
        <section>
          <h3>Crew assessment</h3>
          <ul className="feedback">
            {card.feedback.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <AccordionSection className="detail-source" heading="Posting and source details">
        <JobMetadata card={card} />
        <p className="quiet">Added {new Date(card.createdAt).toLocaleString()}</p>
      </AccordionSection>
    </div>
  );
}
