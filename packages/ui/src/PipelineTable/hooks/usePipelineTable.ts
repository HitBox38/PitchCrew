import { useCallback, useMemo, useState } from 'react';
import { useAttention } from '@/hooks/useAttention.ts';
import { liveRunIndex } from '@/lib/live-runs.ts';
import { pageRange } from '@/lib/pagination.ts';
import { queueStories } from '@/lib/queue-story.ts';
import { useClock } from '@/lib/time.ts';
import { pageSize } from '../constants.ts';
import {
  needsCaption,
  pageColumns,
  pageGroups,
  rangeLabel,
  selectionFacts,
  tableRows,
  tableView,
  togglePage,
  viewCounts,
  visibleRows,
} from '../helpers.ts';
import type { PipelineTableProps } from '../types.ts';

/**
 * The table's state: the saved view (from the URL), the page, and a selection that spans pages and
 * views. Every row, Queue story and count is computed here once per snapshot (and once per half
 * minute for ages), never inside a row.
 */
export const usePipelineTable = ({ data, query, closed, view: wanted }: PipelineTableProps) => {
  const items = useAttention();
  const now = useClock() * 30_000;
  const stories = useMemo(
    () => queueStories(data, items, liveRunIndex(data), now),
    [data, items, now],
  );
  const rows = useMemo(
    () => tableRows(data, items, stories, closed, now),
    [data, items, stories, closed, now],
  );
  const view = closed ? null : tableView(wanted);
  const counts = useMemo(() => viewCounts(rows, query), [rows, query]);
  const visible = useMemo(() => visibleRows(rows, view, query), [rows, view, query]);
  // A new view, search or Open/Closed starts on page one; removals clamp the range.
  const key = `${view}\n${query}\n${closed}`;
  const [position, setPosition] = useState({ page: 0, key });
  if (position.key !== key) setPosition({ page: 0, key });
  const range = pageRange(visible.length, position.key === key ? position.page : 0, pageSize);
  const pageRows = visible.slice(range.start, range.end);
  const [picked, setPicked] = useState<string[]>([]);
  const [selecting, setSelecting] = useState(false);
  const known = new Set(data.cards.map((card) => card.id));
  const selected = picked.filter((id) => known.has(id));
  const pageIds = pageRows.map((row) => row.card.id);
  const selection = selectionFacts(selected, pageIds, new Set(visible.map((row) => row.card.id)));
  // Stable, so a memoized row re-renders only when its own data or checkbox changes.
  const toggle = useCallback(
    (id: string) =>
      setPicked((current) =>
        current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
      ),
    [setPicked],
  );
  return {
    items,
    query,
    closed,
    view,
    counts,
    rows,
    visible,
    pageRows,
    groups: pageGroups(pageRows, view === 'all'),
    columns: pageColumns(closed, pageRows),
    page: range.page,
    pages: range.pages,
    range: rangeLabel(range.start, range.end, visible.length),
    setPage: (page: number) => setPosition({ page, key }),
    caption: view === 'needs-you' ? needsCaption(rows, items) : null,
    /** Closed jobs take no queued action, so the Closed view has no selection. */
    selectable: !closed,
    selected,
    selection,
    /** Phones show row checkboxes only in Select mode. */
    selecting,
    setSelecting,
    toggle,
    togglePage: () => setPicked((current) => togglePage(current, pageIds, selection.all)),
    clear: () => setPicked([]),
    deselect: (ids: ReadonlySet<string>) =>
      setPicked((current) => current.filter((id) => !ids.has(id))),
  };
};

export type TableModel = ReturnType<typeof usePipelineTable>;
