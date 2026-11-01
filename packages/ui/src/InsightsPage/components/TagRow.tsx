import { Button } from '@/components/ui/button/components/Button.tsx';
import { signedWeight } from '@/lib/labels.ts';
import type { ApplicationInsights } from '@pitchcrew/core/insights';
import { share } from '../helpers.ts';
import type { ChangeSearch } from '../types.ts';

/** One tag: name (filters the page) over its companies, then tabular figures. */
export const TagRow = ({
  tag,
  change,
}: {
  tag: ApplicationInsights['tags'][number];
  change: ChangeSearch;
}) => (
  <tr>
    <th scope="row">
      <Button variant="link" className="insights-tag" onClick={() => change({ tag: tag.tag })}>
        {tag.tag}
      </Button>
      <span className="insights-companies">{tag.companies.join(', ')}</span>
    </th>
    <td className="numeric">{tag.count}</td>
    <td className="numeric">{tag.decided}</td>
    <td className="numeric">
      {share(tag.positiveRate)}
      {tag.positiveRate === null ? <span className="sr-only">no decided applications</span> : null}
    </td>
    <td className="numeric">{signedWeight(Math.round(tag.averageWeight * 10) / 10)}</td>
  </tr>
);
