import { signedWeight, weightLabels } from '@/lib/labels.ts';
import type { ApplicationInsights } from '@pitchcrew/core/insights';

export function WeightDistribution({ insights }: { insights: ApplicationInsights }) {
  const largest = Math.max(1, ...insights.weights.map((item) => item.count));
  return (
    <section className="insights-panel" aria-labelledby="insights-weights">
      <h2 id="insights-weights">Weights</h2>
      <p className="quiet">Your own rating of each application. Unrated ones count as neutral.</p>
      <ul className="mt-3 flex flex-col gap-2">
        {insights.weights.map(({ weight, count }) => (
          <li
            key={weight}
            className="weight-row grid grid-cols-[120px_minmax(0,1fr)_32px] items-center gap-3"
            title={`${weightLabels[weight]}: ${count} ${count === 1 ? 'application' : 'applications'}`}
          >
            <span>
              {signedWeight(weight)} {weightLabels[weight]}
            </span>
            <span className="weight-bar" aria-hidden="true">
              <span style={{ width: `${(count / largest) * 100}%` }} />
            </span>
            <span className="text-right tabular-nums">{count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
