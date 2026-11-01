import type { BoardEvent, Snapshot } from '@pitchcrew/core';
import { eventKindLabels } from './constants.ts';

export const pageSize = 50;

const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Today, Yesterday, or a short local date for one day's group heading. */
export const dayLabel = (instant: string, now = new Date()) => {
  const date = new Date(instant);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dayKey(date) === dayKey(now)) return 'Today';
  if (dayKey(date) === dayKey(yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
};

/** Newest-first events grouped by local day, keeping their order. */
export const groupByDay = (events: BoardEvent[], now = new Date()) =>
  events.reduce<{ key: string; label: string; events: BoardEvent[] }[]>((groups, event) => {
    const key = dayKey(new Date(event.createdAt));
    const last = groups.at(-1);
    if (last?.key === key) last.events.push(event);
    else groups.push({ key, label: dayLabel(event.createdAt, now), events: [event] });
    return groups;
  }, []);

/** Matches the stored wording and, when supplied, the sentence the row displays. */
export const filterEvents = (
  events: BoardEvent[],
  query: string,
  kind: string,
  sentence: (event: BoardEvent) => string = () => '',
) =>
  events.filter(
    (event) =>
      (kind === 'all' || event.kind === kind) &&
      `${event.message} ${sentence(event)} ${event.actor} ${eventKindLabels[event.kind]}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );

type Status = { status?: string; state?: string };

const live: Partial<Record<BoardEvent['kind'], keyof Snapshot>> = {
  run: 'runs',
  approval: 'approvals',
  computer_approval: 'computerApprovals',
  user_input: 'userInputs',
  task: 'tasks',
  proposal: 'proposals',
  skill_proposal: 'skillProposals',
};

/** The entity's status now, so an old "running" or "pending" event never claims live work. */
export const currentStatus = (
  event: Pick<BoardEvent, 'kind' | 'entityId'>,
  data: Partial<Snapshot>,
): string | undefined => {
  const key = live[event.kind];
  const items = key ? (data[key] as { id: string; status?: string }[] | undefined) : undefined;
  return items?.find((item) => item.id === event.entityId)?.status;
};

/**
 * The state bead an event records, under the shared bead law: plum for a run still in progress,
 * ochre for something still waiting on you, rose for failure, primary for a completed step and
 * moss for a recorded positive outcome. Everything else is a hollow socket.
 */
export const eventTone = (event: Pick<BoardEvent, 'kind' | 'data'>, current?: string) => {
  const { status: recorded, state } = event.data as Status;
  if (event.kind === 'card')
    return state && ['submitted', 'screening', 'interviewing', 'offer'].includes(state)
      ? 'moss'
      : undefined;
  const open = ['running', 'pending', 'waiting', 'queued'];
  const status = recorded && open.includes(recorded) && current !== recorded ? undefined : recorded;
  if (status === 'running') return 'plum';
  if (status === 'pending' || status === 'waiting') return 'ochre';
  if (status === 'failed') return 'rose';
  if (status === 'completed' || status === 'consumed' || status === 'answered') return 'done';
  return undefined;
};

export type ActivityContext =
  | { type: 'job'; cardId: string; label: string }
  | { type: 'chat'; thread: string; run?: string; label: string }
  | { type: 'page'; to: '/routines' | '/skills' | '/crew' | '/inbox'; label: string };

const pages: Partial<Record<BoardEvent['kind'], Extract<ActivityContext, { type: 'page' }>>> = {
  routine: { type: 'page', to: '/routines', label: 'Routines' },
  skill: { type: 'page', to: '/skills', label: 'Skills' },
  skill_proposal: { type: 'page', to: '/skills', label: 'Skills' },
  role: { type: 'page', to: '/crew', label: 'Crew' },
  proposal: { type: 'page', to: '/crew', label: 'Crew' },
  approval: { type: 'page', to: '/inbox', label: 'Decisions' },
  computer_approval: { type: 'page', to: '/inbox', label: 'Decisions' },
};

/** Where an event can be opened: its run, conversation, job or owning page, if it still exists. */
export const activityContext = (
  event: Pick<BoardEvent, 'kind' | 'entityId' | 'data'>,
  data: Pick<Snapshot, 'cards' | 'conversations'>,
): ActivityContext | null => {
  const fields = event.data as { cardId?: string | null; threadId?: string; id?: string };
  const conversation = (id?: string) =>
    id ? (data.conversations ?? []).find((item) => item.id === id) : undefined;
  if (event.kind === 'run' && fields.threadId && conversation(fields.threadId))
    return { type: 'chat', thread: fields.threadId, run: event.entityId, label: 'Open run' };
  const thread = conversation(event.kind === 'conversation' ? event.entityId : fields.threadId);
  if (thread && ['conversation', 'message', 'user_input'].includes(event.kind))
    return { type: 'chat', thread: thread.id, label: thread.title };
  const page = pages[event.kind];
  if (page) return page;
  const cardId = event.kind === 'card' ? event.entityId : fields.cardId;
  const card = cardId ? data.cards.find((item) => item.id === cardId) : undefined;
  return card ? { type: 'job', cardId: card.id, label: card.company } : null;
};
