import type { Snapshot, WorkQueueView, WorkspaceQueue } from '@pitchcrew/core';
import { stageCounts } from '@/board-stages.ts';
import { crewRoster, crewSummary } from '@/CrewPage/helpers.ts';
import type { AttentionItem } from '@/lib/attention.ts';
import { liveRunIndex } from '@/lib/live-runs.ts';
import { lineWords, readyLine, type LinePlace } from '@/lib/ready-line.ts';
import { requestLabel, roleName, runAction, runAgentLabel } from '@/lib/run-labels.ts';
import { capitalize, withoutSubject } from '@/lib/text.ts';
import { ageLabel, clockLabel, durationLabel } from '@/lib/time.ts';
import { executingRuns, queueIdentity, queueSummary, runActivityLabel } from '@/lib/work-queue.ts';
import { upNextShown, waitingActivity } from './constants.ts';
import type { RailCrew, RailModel, RailRun, RailSlots, UpNextRow, UpNextSegment } from './types.ts';

// Home's rail is a view over job and conversation queues (ADR 0002): slots belong to queues, not
// runs, and the snapshot does not say which queues hold one, so `active of concurrency` is the
// authority and any surplus over the running queues and background routines reads "starting".

/**
 * Runs executing in running queues, oldest first (the order slots were taken), each with the chat
 * stream's latest public step. A run whose browser approval waits in Needs you holds its slot but
 * does nothing until the user decides, so it says so and leads to that row.
 */
const workingRuns = (data: Snapshot, queue: WorkspaceQueue, items: readonly AttentionItem[]) => {
  const { runs } = liveRunIndex(data);
  const asked = new Set(items.map((item) => item.key));
  const waiting = new Map(
    data.computerApprovals
      .filter((approval) => asked.has(`browser:${approval.id}`))
      .map((approval) => [approval.runId, approval]),
  );
  return queueSummary(queue)
    .running.flatMap((view) => {
      const subject = queueIdentity(view, data).title;
      return executingRuns(view.runs.map((run) => runs.get(run.id) ?? run)).map((run): RailRun => {
        const approval = waiting.get(run.id);
        return {
          runId: run.id,
          queueId: view.id,
          cardId: view.cardId,
          threadId: view.threadId,
          subject,
          action: withoutSubject(runAction(run, data), subject),
          roleId: run.roleId,
          agent: runAgentLabel(run, data),
          activity: approval ? waitingActivity : runActivityLabel(run),
          startedAt: run.startedAt,
          waitingSince: approval?.createdAt ?? null,
          itemKey: approval ? `browser:${approval.id}` : null,
        };
      });
    })
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
};

/** A running queue held only by a deep review's seat reservation: a slot with no agent working. */
const reservedLines = (data: Snapshot, queue: WorkspaceQueue) =>
  queueSummary(queue)
    .running.filter(
      (view) =>
        !executingRuns(view.runs).length &&
        view.runs.some((run) => run.reviewSeatReservation && run.status === 'running'),
    )
    .map((view) => `Reserved for ${queueIdentity(view, data).title}’s deep review`);

const slotsOf = (queue: WorkspaceQueue): RailSlots => ({
  active: queue.active,
  concurrency: queue.concurrency,
  background: queue.background,
  starting: Math.max(0, queue.active - queueSummary(queue).running.length - queue.background),
});

/**
 * What a waiting queue starts with: its head request's work (`requestLabel`, so the request an
 * answer queues reads "Continue after your answer", never the agent's own instruction) and agent,
 * or a crew follow-up.
 */
const headWork = (view: WorkQueueView, data: Snapshot) => {
  const head = view.requests[0];
  if (head) {
    const delivery =
      head.deliveries.find((entry) => entry.status === 'queued') ?? head.deliveries[0];
    return { action: requestLabel(head, data), roleId: delivery?.roleId ?? null };
  }
  const task = view.tasks.find((entry) => entry.status === 'queued') ?? view.tasks[0];
  if (!task) return { action: 'Request', roleId: null };
  const parent = data.runs.find((run) => run.id === task.parentRunId);
  return { action: `Follow-up for ${roleName(data, parent?.roleId)}`, roleId: task.roleId };
};

/** A place in the line in words: "Starting", "Next in line", "2nd in line"… */
export const placePhrase = (place: LinePlace) => {
  if (place === 'starting') return 'Starting';
  if (place === 'brief') return 'Waits on you · brief';
  return capitalize(lineWords(place));
};

/**
 * The ready queues as Up next rows, with the places the desk's record words also use (`readyLine`:
 * a queue holding its slot and the first free slots' worth start now, a queue behind a promoted
 * brief takes no place, one its agent cannot start is left out, the rest count).
 */
const upNextRows = (data: Snapshot, items: readonly AttentionItem[]): UpNextRow[] => {
  const briefs = new Map(
    items.flatMap((item) =>
      item.kind === 'brief' && item.queueId ? [[item.queueId, item.key]] : [],
    ),
  );
  return readyLine(data, items).map(({ queue: view, place, holdsSlot }) => {
    const { action, roleId } = headWork(view, data);
    return {
      id: view.id,
      cardId: view.cardId,
      threadId: view.threadId,
      subject: queueIdentity(view, data).title,
      action,
      roleId,
      agent: roleId ? roleName(data, roleId) : '',
      place,
      holdsSlot,
      phrase: placePhrase(place),
      itemKey: place === 'brief' ? (briefs.get(view.id) ?? null) : null,
    };
  });
};

/**
 * Places again over the line as it is shown, so a row moved ahead of the snapshot says where it
 * now stands: the same rule as `readyLine`, with `free` slots starting now. A row that holds its
 * slot keeps "starting" wherever it moves, and a row behind a brief keeps no place.
 */
export const linePlaces = (rows: readonly UpNextRow[], free: number): UpNextRow[] => {
  let starting = free;
  let counted = 0;
  return rows.map((row) => {
    if (row.place === 'brief' || row.holdsSlot) return row;
    let place: LinePlace;
    if (starting > 0) {
      starting -= 1;
      place = 'starting';
    } else place = counted += 1;
    return place === row.place ? row : { ...row, place, phrase: placePhrase(place) };
  });
};

/**
 * The line as Up next draws it, in workspace order: the head and every queue released from the
 * desk this session (wherever it stands, with its true place) in full; each other stretch as one
 * line. A summary of two rows or fewer would take their room, so such a stretch is drawn.
 */
export const upNextSegments = (
  rows: readonly UpNextRow[],
  released: ReadonlySet<string>,
): UpNextSegment[] => {
  const segments: UpNextSegment[] = [];
  rows.forEach((row, index) => {
    const last = segments.at(-1);
    if (index < upNextShown || released.has(row.id)) segments.push({ type: 'row', row });
    else if (last?.type === 'more') last.rows.push(row);
    else segments.push({ type: 'more', key: `more:${row.id}`, rows: [row] });
  });
  return segments.flatMap((segment) =>
    segment.type === 'more' && segment.rows.length <= 2
      ? segment.rows.map((row) => ({ type: 'row' as const, row }))
      : [segment],
  );
};

/** "Kestrel AI", "Kestrel AI and Tidepool", "Kestrel AI, Tidepool and 3 more": never cut mid-name. */
export const restNames = (rows: readonly Pick<UpNextRow, 'subject'>[]) => {
  const [first, second] = rows;
  if (!first) return '';
  if (!second) return first.subject;
  if (rows.length === 2) return `${first.subject} and ${second.subject}`;
  return `${first.subject}, ${second.subject} and ${rows.length - 2} more`;
};

/** "8 agents, 4 working", the working agents in crew order, and "Writer on 2 jobs". */
const crewOf = (data: Snapshot): RailCrew => {
  const jobs = new Map<string, Set<string>>();
  for (const run of executingRuns(data.runs)) {
    const cards = jobs.get(run.roleId) ?? new Set<string>();
    if (run.cardId) cards.add(run.cardId);
    jobs.set(run.roleId, cards);
  }
  const roster = crewRoster(data.roles);
  return {
    summary: crewSummary(data),
    working: roster.filter((role) => jobs.has(role.id)).map((role) => role.id),
    multi: roster.flatMap((role) => {
      const count = jobs.get(role.id)?.size ?? 0;
      return count >= 2 ? [`${role.name} on ${count} jobs`] : [];
    }),
  };
};

/** Everything the rail and the work strip show, built once per snapshot. */
export const railModel = (data: Snapshot, items: readonly AttentionItem[]): RailModel => {
  const queue = data.queue;
  return {
    working: queue ? workingRuns(data, queue, items) : [],
    reserved: queue ? reservedLines(data, queue) : [],
    slots: queue ? slotsOf(queue) : null,
    ready: queue ? queueSummary(queue).ready : [],
    upNext: upNextRows(data, items),
    heldByYou: queue?.queues.filter((view) => view.pauseKind === 'user').length ?? 0,
    crew: crewOf(data),
    pipeline: stageCounts(data.cards),
  };
};

/** "5 of 5 slots · 3 up next", beside Crew at work's title on a phone. */
export const crewFact = ({ slots, upNext }: Pick<RailModel, 'slots' | 'upNext'>) =>
  [slots ? `${slots.active} of ${slots.concurrency} slots` : '', `${upNext.length} up next`]
    .filter(Boolean)
    .join(' · ');

/** "5 of 5 work slots in use". */
export const slotsInUse = ({ active, concurrency }: RailSlots) =>
  `${active} of ${concurrency} work ${concurrency === 1 ? 'slot' : 'slots'} in use`;

/** The lines under Working now's runs that explain every other slot in use. */
export const slotNotes = (rail: Pick<RailModel, 'reserved' | 'slots'>) => {
  const background = rail.slots?.background ?? 0;
  const starting = rail.slots?.starting ?? 0;
  return [
    ...rail.reserved,
    ...(background
      ? [
          `${background} background ${background === 1 ? 'routine' : 'routines'} running outside these queues`,
        ]
      : []),
    ...(starting ? [`${starting} starting`] : []),
  ];
};

/**
 * A run's time and what it measures: how long it has waited on the user ("waiting 4 min"), or
 * its own length ("20 min"), in Home's long style.
 */
export const runTiming = (run: Pick<RailRun, 'waitingSince' | 'startedAt'>, now: number) =>
  run.waitingSince
    ? {
        time: `waiting ${ageLabel(run.waitingSince, now)}`,
        since: `Waiting on you since ${clockLabel(run.waitingSince)}`,
      }
    : {
        time: durationLabel(run.startedAt, now),
        since: `Running since ${clockLabel(run.startedAt)}`,
      };

/** Working now with nothing in a slot. */
export const idleLine = (concurrency: number) =>
  `Nothing is running. ${concurrency === 1 ? 'The work slot is' : `All ${concurrency} slots are`} free.`;
