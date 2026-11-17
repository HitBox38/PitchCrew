import { keyedItems } from '@/lib/list-keys.ts';
import type { ReviewFinding } from '@pitchcrew/core';
import { reviewPerspectives } from '@pitchcrew/core/deep-review-labels';
/** Findings quote the resume; blockers come first and read in rose, suggestions stay quiet. */
export const ReviewFindings = ({
  findings,
  title = 'Prioritized findings',
}: {
  findings: ReviewFinding[];
  title?: string;
}) => {
  return (
    <section className="deep-review-findings" aria-label={title}>
      <h4>{title}</h4>
      {findings.length ? (
        <ol className="grid gap-4">
          {keyedItems(findings, (item) => JSON.stringify(item)).map(({ item, key }) => (
            <li key={key} className="grid gap-1.5" data-severity={item.severity}>
              <p className="deep-review-finding-head">
                <strong>{item.severity === 'blocking' ? 'Blocker' : 'Suggestion'}</strong>
                <span>{item.perspectives.map((id) => reviewPerspectives[id]).join(', ')}</span>
              </p>
              <blockquote className="review-quote whitespace-pre-wrap">{item.quote}</blockquote>
              <p>{item.reason}</p>
              <p>
                <strong>Correction: </strong>
                {item.correction}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="quiet">Nothing open. Evidence and required answers are checked separately.</p>
      )}
    </section>
  );
};
