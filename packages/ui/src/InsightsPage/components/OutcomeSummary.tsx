import { outcomeLabels } from '@/lib/labels.ts';
import { outcomes, type ApplicationInsights } from '@pitchcrew/core/insights';
import { outcomeHints } from '../constants.ts';

export function OutcomeSummary({ insights }: { insights: ApplicationInsights }) {
  return (
    <section aria-labelledby="insights-outcomes">
      <h2 id="insights-outcomes" className="sr-only">
        Outcomes
      </h2>
      <dl className="grid grid-cols-2 gap-3 wide:grid-cols-5">
        <div className="insight-tile">
          <dt>Applications</dt>
          <dd>{insights.total}</dd>
          <small>Matching the filters</small>
        </div>
        {outcomes.map((outcome) => (
          <div key={outcome} className={`insight-tile ${outcome}`}>
            <dt>
              <span className="outcome-dot" aria-hidden="true" />
              {outcomeLabels[outcome]}
            </dt>
            <dd>{insights.outcomes[outcome]}</dd>
            <small>{outcomeHints[outcome]}</small>
          </div>
        ))}
      </dl>
    </section>
  );
}
