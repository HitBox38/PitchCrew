import type { Card } from '@pitchcrew/core';
import { jobHeadingMeta } from '../presentation.ts';

/** A job chat leads with its job: company, role and where it stands. */
export const ClayJobTitle = ({ card }: { card: Card }) => {
  const meta = jobHeadingMeta(card);
  return (
    <div className="clay-job-title">
      <h1 title={`${card.company} · ${card.title}`}>
        <strong>{card.company}</strong> <span>{card.title}</span>
      </h1>
      {meta ? <span className="clay-job-title-meta">{meta}</span> : null}
    </div>
  );
};
