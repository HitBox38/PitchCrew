import type { ReviewFinding } from '@pitchcrew/core';
import { reviewPerspectives } from '@pitchcrew/core/deep-review-labels';
export const ReviewFindings = ({ findings }: { findings: ReviewFinding[] }) => {
  return (
    <section className="grid gap-3" aria-label="Review findings">
      <h3>Prioritized findings</h3>
      {findings.length ? (
        <ol className="grid list-decimal gap-5 pl-5">
          {findings.map((item, index) => (
            <li key={index} className="space-y-2 pl-1">
              <p>
                <strong>{item.severity === 'blocking' ? 'Blocker' : 'Suggestion'}</strong> ·{' '}
                {item.perspectives.map((id) => reviewPerspectives[id]).join(', ')}
              </p>
              <blockquote className="border-l-2 border-border pl-3 whitespace-pre-wrap">
                {item.quote}
              </blockquote>
              <p>{item.reason}</p>
              <p>
                <strong>Correction: </strong>
                {item.correction}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p>
          No additional resume findings. The packet’s evidence and required answers are checked
          separately.
        </p>
      )}
    </section>
  );
};
