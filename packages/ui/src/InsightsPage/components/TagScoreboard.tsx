import { Button } from '@/components/ui/button/components/Button.tsx';
import { signedWeight } from '@/lib/labels.ts';
import type { ApplicationInsights } from '@pitchcrew/core/insights';
import { percent } from '../helpers.ts';
import type { ChangeSearch } from '../types.ts';

export function TagScoreboard({
  insights,
  change,
}: {
  insights: ApplicationInsights;
  change: ChangeSearch;
}) {
  return (
    <section className="insights-panel" aria-labelledby="insights-tags">
      <h2 id="insights-tags">Tag scoreboard</h2>
      <p className="quiet">
        Positive share counts only decided applications. Small numbers are weak evidence.
      </p>
      {insights.tags.length ? (
        <div className="mt-3 overflow-x-auto">
          <table className="insights-table w-full">
            <thead>
              <tr>
                <th scope="col">Tag</th>
                <th scope="col">Applications</th>
                <th scope="col">Positive</th>
                <th scope="col">Average weight</th>
                <th scope="col">Companies</th>
              </tr>
            </thead>
            <tbody>
              {insights.tags.map((tag) => (
                <tr key={tag.tag}>
                  <th scope="row">
                    <Button
                      variant="link"
                      className="h-auto p-0"
                      onClick={() => change({ tag: tag.tag })}
                    >
                      {tag.tag}
                    </Button>
                  </th>
                  <td>{tag.count}</td>
                  <td>
                    {percent(tag.positiveRate)}
                    {tag.decided ? <small className="quiet"> of {tag.decided}</small> : null}
                  </td>
                  <td>{signedWeight(Math.round(tag.averageWeight * 10) / 10)}</td>
                  <td>{tag.companies.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="quiet">Add tags to jobs to compare how they go.</p>
      )}
      {insights.tagCount > insights.tags.length ? (
        <p className="quiet mt-2">
          Showing {insights.tags.length} of {insights.tagCount} tags.
        </p>
      ) : null}
    </section>
  );
}
