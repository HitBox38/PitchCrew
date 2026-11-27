import type { Card, Snapshot, WorkQueueView } from '@pitchcrew/core';
import { groupCount, matchesJobQuery } from '@/BoardPage/helpers.ts';
import { closedStateSet } from '@/board-stages.ts';
import { stateTone } from '@/ClayInterface/helpers.ts';
import { headStartBlock } from '@/lib/agent-start.ts';
import { recoveryQueue, type AttentionItem } from '@/lib/attention.ts';
import { stateLabels } from '@/lib/labels.ts';
import type { QueueStory } from '@/lib/queue-story.ts';
import { readyLine } from '@/lib/ready-line.ts';
import { ageLabel } from '@/lib/time.ts';
import { queueFailed } from '@/lib/work-queue.ts';
import { closedEmpty, emptyLines, groupOrder, tableColumns, tableViews } from './constants.ts';
import type {
  SelectionFacts,
  TableGroup,
  TableRowModel,
  TableView,
  ViewCount,
  ViewDef,
} from './types.ts';

const viewIds = new Set<string>(tableViews.map((view) => view.id));

/** `?view=` as a saved view; an unknown name falls back to All open. */
export const tableView = (view: string | undefined): TableView =>
  view && viewIds.has(view) ? (view as TableView) : 'all';

export const viewDef = (view: TableView) => tableViews.find((entry) => entry.id === view)!;

/**
 * The saved views a job belongs to: Needs you while it holds an attention item; Working, Waiting
 * for a slot or On hold by its job queue's state (On hold counts paused, blocked and waiting
 * queues, failures included; a ready queue held behind a promoted brief takes no place in line, so
 * it waits on the brief in Needs you, not for a slot, and one whose agent cannot start its next
 * request (`headStartBlock`) is on hold); Failed by the app-bar chip's rule (a lane
 * stopped for recovery whose work failed), so the two counts agree; Not scored for a lead without a
 * fit score.
 */
export const viewsOf = (
  card: Pick<Card, 'state' | 'fit'>,
  queue: Pick<WorkQueueView, 'state' | 'paused' | 'pauseKind'> | undefined,
  asked: boolean,
  briefHeld = false,
  agentHeld = false,
): TableView[] => {
  const views: TableView[] = ['all'];
  if (asked) views.push('needs-you');
  if (queue?.state === 'running') views.push('working');
  if (queue?.state === 'ready' && !briefHeld && !agentHeld) views.push('waiting');
  if (queue && (['paused', 'blocked', 'waiting'].includes(queue.state) || agentHeld))
    views.push('on-hold');
  if (queue && recoveryQueue(queue) && queueFailed(queue)) views.push('failed');
  if (card.state === 'lead' && card.fit == null) views.push('not-scored');
  return views;
};

/**
 * The columns a page shows: every one, except that the Closed view drops Queue while none of its
 * rows has a story or a next step to tell (closed jobs rarely do), rather than head a blank column.
 */
export const pageColumns = (closed: boolean, rows: readonly TableRowModel[]) =>
  !closed || rows.some((row) => row.story.kind !== 'idle' || row.story.text)
    ? tableColumns
    : tableColumns.filter(([id]) => id !== 'queue');

/** A row's group, from its Queue story: what the cell says is what the group says. */
const groupOf = (story: QueueStory): TableGroup => {
  if (story.kind === 'asks') return 'needs';
  if (story.kind === 'waiting') return 'waiting';
  if (story.kind === 'held') return 'held';
  return story.kind === 'idle' ? 'idle' : 'working';
};

const newest = (a: TableRowModel, b: TableRowModel) =>
  b.card.updatedAt.localeCompare(a.card.updatedAt) || a.card.company.localeCompare(b.card.company);

/** "just now", "3m ago", "2h ago", then the date, in the Queue cell's lower case and clock. */
export const updatedLabel = (iso: string, now: number) => {
  const age = ageLabel(iso, now, 'compact');
  if (!age || age === 'just now') return age;
  if (!age.endsWith('d')) return `${age} ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

/**
 * Open jobs (or closed ones, for the Closed view) as rows in the table's one order: Needs you by
 * attention rank, Working by latest update, Waiting for a slot by place in line, On hold and
 * Nothing queued by latest update. Closed rows are newest first.
 */
export const tableRows = (
  data: Snapshot,
  items: readonly AttentionItem[],
  stories: ReadonlyMap<string, QueueStory>,
  closed: boolean,
  now: number,
): TableRowModel[] => {
  const queues = new Map((data.queue?.queues ?? []).map((queue) => [queue.id, queue]));
  const rank = new Map<string, number>();
  items.forEach((item, index) => {
    if (item.cardId && !rank.has(item.cardId)) rank.set(item.cardId, index);
  });
  // Up next's line: a queue behind a promoted brief takes no place in it.
  const briefHeld = new Set(
    readyLine(data, items).flatMap(({ queue, place }) => (place === 'brief' ? [queue.id] : [])),
  );
  const rows = data.cards
    .filter((card) => closedStateSet.has(card.state) === closed)
    .map((card): TableRowModel => {
      const story = stories.get(card.id)!;
      const queue = queues.get(`job:${card.id}`);
      const agentHeld = queue?.state === 'ready' && !!headStartBlock(data, queue);
      return {
        card,
        stage: { tone: stateTone(card.state), label: stateLabels[card.state] },
        story,
        group: groupOf(story),
        views: viewsOf(
          card,
          queue,
          rank.has(card.id),
          !!queue && briefHeld.has(queue.id),
          agentHeld,
        ),
        updated: updatedLabel(card.updatedAt, now),
      };
    });
  if (closed) return rows.sort(newest);
  const position = (row: TableRowModel) =>
    row.group === 'needs'
      ? (rank.get(row.card.id) ?? 0)
      : row.group === 'waiting'
        ? (row.story.line ?? 0)
        : 0;
  return rows.sort(
    (a, b) =>
      groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group) ||
      position(a) - position(b) ||
      newest(a, b),
  );
};

/** Every view's size, and how many of it match the search ("18 of 38" while searching). */
export const viewCounts = (rows: readonly TableRowModel[], query: string) => {
  const counts = Object.fromEntries(
    tableViews.map((view) => [view.id, { matching: 0, total: 0 }]),
  ) as Record<TableView, ViewCount>;
  for (const row of rows) {
    const match = matchesJobQuery(row.card, query);
    for (const view of row.views) {
      counts[view].total += 1;
      if (match) counts[view].matching += 1;
    }
  }
  return counts;
};

/** A view's count as shown and its bead: an empty socket once nothing is in it. */
export const viewFacts = (view: ViewDef, { matching, total }: ViewCount, query: string) => ({
  count: groupCount(matching, total, query),
  tone: view.tone && ((query.trim() ? matching : total) ? view.tone : 'socket'),
});

/** The rows a view lists under the search, in the table's order. */
export const visibleRows = (
  rows: readonly TableRowModel[],
  view: TableView | null,
  query: string,
) => rows.filter((row) => (!view || row.views.includes(view)) && matchesJobQuery(row.card, query));

/** A page's rows under All open's group labels; every other view is one unlabelled group. */
export const pageGroups = (rows: readonly TableRowModel[], labelled: boolean) =>
  labelled
    ? groupOrder
        .map((id) => ({ id, rows: rows.filter((row) => row.group === id) }))
        .filter((group) => group.rows.length)
    : [{ id: null, rows: [...rows] }];

/**
 * The Needs you view's caption: how many listed jobs wait on the user, and how many of Home's
 * items are not on them (job-free asks, or a job outside the open table), so Home keeps the one
 * count and this view never claims it.
 */
export const needsCaption = (rows: readonly TableRowModel[], items: readonly AttentionItem[]) => {
  const listed = new Set(
    rows.filter((row) => row.views.includes('needs-you')).map((row) => row.card.id),
  );
  const onListed = items.filter((item) => item.cardId && listed.has(item.cardId)).length;
  const jobs = listed.size;
  return {
    text: `${jobs} ${jobs === 1 ? 'job waits' : 'jobs wait'} on you`,
    more: items.length - onListed,
  };
};

/** "1–40 of 114 jobs"; a page of one job names it alone ("41 of 41 jobs"). */
export const rangeLabel = (start: number, end: number, total: number) => {
  const noun = total === 1 ? 'job' : 'jobs';
  if (!total) return `0 ${noun}`;
  return `${end - start === 1 ? end : `${start + 1}–${end}`} of ${total} ${noun}`;
};

/** An empty list's sentence: what is true of the view, or that the search finds none of it. */
export const emptyLine = (view: TableView | null, total: number, query: string) => {
  const needle = query.trim();
  const label = view ? viewDef(view).label : 'Closed';
  if (!needle || !total) return view ? emptyLines[view] : closedEmpty;
  return total === 1
    ? `The one job in ${label} does not match “${needle}”.`
    : `None of the ${total} jobs in ${label} match “${needle}”.`;
};

/** Where the selection sits relative to the page and the view it is shown in. */
export const selectionFacts = (
  selected: readonly string[],
  pageIds: readonly string[],
  viewIds: ReadonlySet<string>,
): SelectionFacts => {
  const page = new Set(pageIds);
  const onPage = selected.filter((id) => page.has(id)).length;
  const inView = selected.filter((id) => viewIds.has(id)).length;
  return {
    count: selected.length,
    onPage,
    otherPages: inView - onPage,
    notShown: selected.length - inView,
    all: pageIds.length > 0 && onPage === pageIds.length,
    some: onPage > 0,
  };
};

/** The header checkbox: clears the page when all of it is selected, else selects the rest. */
export const togglePage = (
  selected: readonly string[],
  pageIds: readonly string[],
  all: boolean,
) =>
  all
    ? selected.filter((id) => !pageIds.includes(id))
    : [...selected, ...pageIds.filter((id) => !selected.includes(id))];
