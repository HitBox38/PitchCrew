import { dropStages } from '../board-stages.ts';
import type { Card, CardState, Snapshot } from '@pitchcrew/core';
import { stateLabels } from '../lib/labels.ts';

export type PipelineStage = (typeof dropStages)[number];
export type PipelineDrop =
  | { kind: 'move'; state: CardState; label: string }
  | { kind: 'blocked'; label: string };

/** A drag records a manual status, independently of the crew workflow. */
export function statusDrop(card: Card, state: CardState, data: Snapshot): PipelineDrop {
  if (!canDragJob(card, data))
    return { kind: 'blocked', label: 'Wait for the active run to finish.' };
  if (state === card.state) return { kind: 'blocked', label: 'Already in this status.' };
  return { kind: 'move', state, label: `Drop to move to ${stateLabels[state]}` };
}

export function pipelineDrop(card: Card, stage: PipelineStage, data: Snapshot): PipelineDrop {
  if (stage.states.includes(card.state))
    return { kind: 'blocked', label: 'Choose another status in this group.' };
  return statusDrop(card, stage.states[0], data);
}

export function canDragJob(card: Card, data: Snapshot) {
  return (
    !card.owner && !data.runs.some((run) => run.cardId === card.id && run.status === 'running')
  );
}
