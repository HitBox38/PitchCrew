import type { Card } from '@pitchcrew/core';
import { Button } from '@/components/ui/button/index.tsx';

type BriefDecisionProps = {
  card: Card;
  openCard: (id: string, section?: 'application') => void;
};

/** A read-only preview; confirming still happens in job details with its full checks. */
export const BriefDecision = ({ card, openCard }: BriefDecisionProps) => {
  const context = card.applicationContext;
  const brief = context?.brief;
  const requirements = context?.requirements ?? [];
  const missing = requirements.filter(
    (item) => item.required && item.personal && !item.answer.trim(),
  ).length;
  const facts = (
    [
      ['Responsibilities', brief?.responsibilities.length ?? 0, false],
      ['Qualifications', brief?.qualifications.length ?? 0, false],
      ['Questions', requirements.length, false],
      ['Answers needed', missing, true],
    ] as const
  ).filter(([, count]) => count > 0);
  return (
    <div className="clay-decide-brief">
      <p>
        A brief was extracted from the posting. Check it and answer anything personal before
        drafting. Writer and Reviewer only see what you confirm.
      </p>
      {brief?.companyContext ? <p className="clay-decide-quote">{brief.companyContext}</p> : null}
      {facts.length ? (
        <dl className="clay-decide-facts">
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
        <ul className="clay-decide-lines">
          {brief.qualifications.slice(0, 4).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      <Button onClick={() => openCard(card.id, 'application')}>
        {missing ? 'Answer and confirm' : 'Review and confirm'}
      </Button>
    </div>
  );
};
