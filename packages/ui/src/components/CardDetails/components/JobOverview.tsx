import { CrewAssessment } from './CrewAssessment.tsx';
import { PostingText } from './PostingText.tsx';
import { JobMetadata } from './JobMetadata.tsx';
import type { JobOverviewProps } from '../types.ts';
import { AccordionSection } from '@pitchcrew/design-system/accordion';

/** The scored read leads, so a lead's decision sits beside its evidence; then the posting itself. */
export const JobOverview = (model: JobOverviewProps) => {
  const { card } = model;
  return (
    <div className="detail-job">
      {/* Before drafting, feedback is Scout's read; afterwards Writer and Reviewer notes replace it
          and are shown with the documents and reviews they are about. */}
      {card.feedback.length && (card.state === 'lead' || card.state === 'shortlisted') ? (
        <CrewAssessment notes={card.feedback} />
      ) : null}
      <section>
        <h3>About the role</h3>
        {/* The saved posting text exactly as stored, set as readable prose. */}
        <PostingText
          text={
            card.description || 'No description was added. Open the original posting for details.'
          }
        />
        {card.tags.length ? (
          <div className="tags flex flex-wrap gap-1">
            {card.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        ) : null}
      </section>
      <AccordionSection className="detail-source" heading="Posting and source details">
        <JobMetadata card={card} />
        <p className="quiet">Added {new Date(card.createdAt).toLocaleString()}</p>
      </AccordionSection>
    </div>
  );
};
