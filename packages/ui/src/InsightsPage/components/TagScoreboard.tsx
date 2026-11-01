import { useState } from 'react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { ApplicationInsights } from '@pitchcrew/core/insights';
import { tagPreview } from '../constants.ts';
import type { ChangeSearch } from '../types.ts';
import { TagRow } from './TagRow.tsx';
import { TagSortHeader } from './TagSortHeader.tsx';

/** Tag table: the first rows show at once; Show all reveals every computed tag. */
export const TagScoreboard = ({
  insights,
  change,
}: {
  insights: ApplicationInsights;
  change: ChangeSearch;
}) => {
  const [expanded, setExpanded] = useState(false);
  const sort = insights.filter.sort;
  const header = { sort, change };
  const rows = expanded ? insights.tags : insights.tags.slice(0, tagPreview);
  return (
    <section className="ui-section insights-tags" aria-labelledby="insights-tags">
      <h2 id="insights-tags" className="ui-section-heading">
        Tags <span className="ui-count">{insights.tagCount}</span>
        {insights.tags.length ? (
          <span className="ui-section-action insights-note">
            Positive share counts decided applications only. Small numbers are weak evidence.
          </span>
        ) : null}
      </h2>
      {insights.tags.length ? (
        <div className="ui-tray insights-table-tray">
          <table className="insights-table">
            <thead>
              <tr>
                <TagSortHeader {...header} value="tag" label="Tag" />
                <TagSortHeader {...header} value="count" label="Applications" numeric />
                <th scope="col" className="numeric">
                  Decided
                </th>
                <TagSortHeader {...header} value="positive" label="Positive share" numeric />
                <TagSortHeader {...header} value="weight" label="Average weight" numeric />
              </tr>
            </thead>
            <tbody>
              {rows.map((tag) => (
                <TagRow key={tag.tag} tag={tag} change={change} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="ui-empty">
          {insights.total
            ? 'Add tags to jobs to compare how they go.'
            : 'No tagged applications yet.'}
        </p>
      )}
      {insights.tags.length > tagPreview ? (
        <Button
          variant="ghost"
          size="sm"
          className="insights-after"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show fewer tags' : `Show all ${insights.tags.length} tags`}
        </Button>
      ) : null}
      {insights.tagCount > insights.tags.length ? (
        <p className="insights-note insights-after">
          Showing {insights.tags.length} of {insights.tagCount} tags.
        </p>
      ) : null}
    </section>
  );
};
