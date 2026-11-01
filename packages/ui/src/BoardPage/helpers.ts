import { dropStages } from '../board-stages.ts';
import type { Card, CardState, Snapshot } from '@pitchcrew/core';
import { stateLabels } from '../lib/labels.ts';

export type PipelineStage = (typeof dropStages)[number];
export type PipelineDrop =
  | { kind: 'move'; state: CardState; label: string }
  | { kind: 'blocked'; label: string };

/** A drag records a manual status, independently of the crew workflow. */
export const statusDrop = (card: Card, state: CardState, data: Snapshot): PipelineDrop => {
  if (!canDragJob(card, data))
    return { kind: 'blocked', label: 'Wait for the active run to finish.' };
  if (state === card.state) return { kind: 'blocked', label: 'Already in this status.' };
  return { kind: 'move', state, label: `Drop to move to ${stateLabels[state]}` };
};

/** A column with one status accepts drops; a grouped column needs its exact status target. */
export const pipelineDrop = (card: Card, stage: PipelineStage, data: Snapshot): PipelineDrop => {
  if (stage.states.length > 1)
    return { kind: 'blocked', label: `Drop on a status in ${stage.label}.` };
  if (stage.states.includes(card.state))
    return { kind: 'blocked', label: 'Already in this status.' };
  return statusDrop(card, stage.states[0], data);
};

export const canDragJob = (card: Card, data: Snapshot) => {
  return (
    !card.owner && !data.runs.some((run) => run.cardId === card.id && run.status === 'running')
  );
};

/** Board search: company, title, location and tags, across every job before sorting and paging. */
export const matchesJobQuery = (card: Card, query: string) =>
  `${card.company} ${card.title} ${card.location} ${card.tags.join(' ')}`
    .toLowerCase()
    .includes(query.trim().toLowerCase());

/** A column count: the full group, or matches and total while searching. */
export const groupCount = (matching: number, total: number, query: string) =>
  query.trim() && matching !== total ? `${matching} of ${total}` : String(total);
