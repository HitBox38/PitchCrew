import type { JobHeadingProps } from '@/components/CardDetails/types.ts';
import { CompanyMark } from '@/components/CompanyMark/index.tsx';

/** Company, place and pay on one quiet line above the title, so identity takes two rows. */
export const JobHeading = ({ card }: JobHeadingProps) => {
  const facts = [card.location, card.salary].filter(Boolean).join(' · ');
  return (
    <div className="detail-company">
      <CompanyMark name={card.company} />
      <div>
        <span>
          <span className="detail-company-name">{card.company}</span>
          {card.sample ? <span className="badge">Example</span> : null}
          {facts ? <span className="detail-facts">{facts}</span> : null}
        </span>
        <h2>{card.title}</h2>
      </div>
    </div>
  );
};
