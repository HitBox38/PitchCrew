import type { Card } from '@pitchcrew/core';
import { briefAnswersNeeded } from '../helpers.ts';

/** A read-only preview; confirming still happens in job details with its full checks. */
export const BriefDecision = ({ card }: { card: Card }) => {
  const context = card.applicationContext;
  const brief = context?.brief;
  const form = context?.form;
  const missing = briefAnswersNeeded(card);
  const facts = (
    [
      ['Responsibilities', brief?.responsibilities.length ?? 0, false],
      ['Qualifications', brief?.qualifications.length ?? 0, false],
      ['Questions', context?.requirements.length ?? 0, false],
      ['Answers needed', missing, true],
    ] as const
  ).filter(([, count]) => count > 0);
  return (
    <div className="packet-details">
      <p className="decide-lead">
        A brief was extracted from the posting. Check it and answer anything personal before
        drafting.
      </p>
      {brief?.companyContext ? <p className="decide-quote">{brief.companyContext}</p> : null}
      {facts.length ? (
        <dl className="decide-facts">
          {facts.map(([label, count, attention]) => (
            <div key={label} data-attention={attention ? '' : undefined}>
              <dt>{label}</dt>
              <dd>{count}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-ochre">
          This brief lists no requirements. Check it against the posting in job details.
        </p>
      )}
      {brief?.qualifications.length ? (
        <section className="packet-section" aria-label="Qualifications">
          <h3 className="packet-section-heading">Qualifications</h3>
          <ul className="decide-lines">
            {brief.qualifications.slice(0, 4).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="packet-section" aria-label="Application form">
        <h3 className="packet-section-heading">Application form</h3>
        <p className="decide-lines-note">
          {form?.status === 'inspected'
            ? `Inspected: ${form.fields.filter((field) => field.visible).length} fields${form.uninspected.length ? `, ${form.uninspected.length} sections not inspected` : ''}.`
            : form?.status === 'manual'
              ? 'You chose to check this form yourself.'
              : 'Not inspected yet. Its fields and uploads are unchecked.'}
        </p>
      </section>
    </div>
  );
};
