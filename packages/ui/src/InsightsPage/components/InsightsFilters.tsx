import { DateTimePicker } from '@/DateTimePicker/index.tsx';
import { FormSelect } from '@/FormSelect/index.tsx';
import { Button } from '@pitchcrew/design-system/button';
import { tagKey, type TagSort } from '@pitchcrew/core/insights';
import { sortOptions } from '../constants.ts';
import type { ChangeSearch, InsightsSearch } from '../types.ts';

/** One URL-backed filter row: tag, applied-from, applied-until and tag sort. */
export const InsightsFilters = ({
  search,
  tags,
  change,
  filtered,
}: {
  search: InsightsSearch;
  tags: string[];
  change: ChangeSearch;
  filtered: boolean;
}) => {
  const tagOptions = [
    { value: '', label: 'All tags' },
    ...tags.map((tag) => ({ value: tag, label: tag })),
  ];
  return (
    <section className="insights-filters" aria-label="Insights filters">
      <FormSelect
        label="Tag"
        value={tags.find((tag) => search.tag && tagKey(tag) === tagKey(search.tag)) ?? ''}
        options={tagOptions}
        onValueChange={(tag) => change({ tag: tag || undefined })}
      />
      <DateTimePicker
        label="Applied from"
        value={search.from ?? ''}
        onValueChange={(from) => change({ from: from || undefined })}
      />
      <DateTimePicker
        label="Applied until"
        value={search.to ?? ''}
        onValueChange={(to) => change({ to: to || undefined })}
      />
      <FormSelect<TagSort>
        label="Sort tags by"
        value={search.sort ?? 'count'}
        options={sortOptions}
        onValueChange={(sort) => change({ sort: sort === 'count' ? undefined : sort })}
      />
      {filtered ? (
        <Button
          className="button small"
          onClick={() => change({ tag: undefined, from: undefined, to: undefined })}
        >
          Clear filters
        </Button>
      ) : null}
    </section>
  );
};
