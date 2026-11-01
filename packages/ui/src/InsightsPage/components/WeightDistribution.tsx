import { signedWeight, weightLabels } from '@/lib/labels.ts';
import type { ApplicationInsights } from '@pitchcrew/core/insights';

/** Your own signed ratings (−2 to +2); unrated applications count as neutral. */
export const WeightDistribution = ({ insights }: { insights: ApplicationInsights }) => {
  const largest = Math.max(1, ...insights.weights.map((item) => item.count));
  return (
    <section className="insights-weights" aria-labelledby="insights-weights">
      <h2 id="insights-weights" className="ui-section-heading">
        Weights
        <span className="ui-section-action insights-note">Unrated count as neutral</span>
      </h2>
      {insights.total ? (
        <ul className="ui-tray insights-weight-list">
          {insights.weights.map(({ weight, count }) => (
            <li
              key={weight}
              data-sign={weight > 0 ? 'positive' : weight < 0 ? 'negative' : 'neutral'}
              title={`${weightLabels[weight]}: ${count} ${count === 1 ? 'application' : 'applications'}`}
            >
              <span className="insights-weight-label">
                <span className="insights-weight-value">{signedWeight(weight)}</span>
                {weightLabels[weight]}
              </span>
              <span className="insights-weight-bar" aria-hidden="true">
                <span style={{ width: `${(count / largest) * 100}%` }} />
              </span>
              <span className="numeric">{count}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ui-empty">No weighted applications yet.</p>
      )}
    </section>
  );
};
