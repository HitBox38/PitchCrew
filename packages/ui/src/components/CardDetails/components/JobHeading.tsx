import type { JobHeadingProps } from '@/components/CardDetails/types.ts';
import { CompanyMark } from '@/components/CompanyMark/index.tsx';

export function JobHeading({ card }: JobHeadingProps) {
  return (
    <div className="detail-company">
      <CompanyMark name={card.company} />
      <div>
        <span>
          {card.company}
          {card.sample ? <span className="badge">Example</span> : null}
        </span>
        <h2>{card.title}</h2>
      </div>
    </div>
  );
}
