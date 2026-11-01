import { Button } from '@/components/ui/button/components/Button.tsx';
import { outcomes, type ApplicationInsights } from '@pitchcrew/core/insights';
import { outcomeHints } from '../constants.ts';
import type { ChangeSearch } from '../types.ts';

/** Recessed figures strip. Zeros print as 0 (they are the honest empty state); example jobs are
 * never counted. */
export const OutcomeSummary = ({
  insights,
  filtered,
  change,
}: {
  insights: ApplicationInsights;
  filtered: boolean;
  change: ChangeSearch;
}) => {
  return (
    <section className="insights-figures-section" aria-labelledby="insights-outcomes">
      <h2 id="insights-outcomes" className="sr-only">
        Outcomes
      </h2>
      <dl className="insights-figures">
        <div>
          <dt>Applications</dt>
          <dd>{insights.total}</dd>
        </div>
        {outcomes.map((outcome) => (
          <div key={outcome} data-outcome={outcome}>
            <dt>{outcomeHints[outcome]}</dt>
            <dd>{insights.outcomes[outcome]}</dd>
          </div>
        ))}
      </dl>
      {!insights.total && filtered ? (
        <p className="insights-empty-line">
          No applications match these filters.{' '}
          <Button
            variant="outline"
            size="sm"
            onClick={() => change({ tag: undefined, from: undefined, to: undefined })}
          >
            Clear filters
          </Button>
        </p>
      ) : null}
    </section>
  );
};
