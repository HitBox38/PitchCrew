import { DateTimePicker } from '@/DateTimePicker/index.tsx';
import { FormSelect } from '@/FormSelect/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { tagKey, type TagSort } from '@pitchcrew/core/insights';
import { sortOptions } from '../constants.ts';
import type { ChangeSearch, InsightsSearch } from '../types.ts';

export function InsightsFilters({
  search,
  tags,
  change,
}: {
  search: InsightsSearch;
  tags: string[];
  change: ChangeSearch;
}) {
  const tagOptions = [
    { value: '', label: 'All tags' },
    ...tags.map((tag) => ({ value: tag, label: tag })),
  ];
  const filtered = Boolean(search.tag || search.from || search.to);
  return (
    <div className="insights-filters flex flex-wrap items-end gap-3">
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
    </div>
  );
}
