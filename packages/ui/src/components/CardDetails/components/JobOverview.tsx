import { OutcomeActions } from '@/components/CardDetails/components/OutcomeActions.tsx';
import type { JobOverviewProps } from '@/components/CardDetails/types.ts';

export function JobOverview({ card, working, run, act }: JobOverviewProps) {
  return (
    <>
      <div className="tags">
        {card.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <h3>Description</h3>
      <p className="prewrap">{card.description || 'No description was added.'}</p>
      {card.feedback.length ? (
        <>
          <h3>{card.state === 'lead' ? 'Scout notes' : 'Review notes'}</h3>
          <ul className="feedback">
            {card.feedback.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </>
      ) : null}
      <h3>Outcome</h3>
      <p className="quiet">Record what happened after you applied.</p>
      <OutcomeActions card={card} working={working} run={run} act={act} />
    </>
  );
}
