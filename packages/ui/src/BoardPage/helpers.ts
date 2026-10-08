import { stages } from '../board-stages.ts';
import type { Card, CardState, Snapshot } from '@pitchcrew/core';
import { transitions, workflowSeat } from '@pitchcrew/core/states';

export type PipelineStage = (typeof stages)[number];
export type PipelineDrop =
  | { kind: 'move'; state: CardState; label: string }
  | { kind: 'run'; roleId: string; label: string }
  | { kind: 'blocked'; label: string };

/** Resolve a column to an explicit user action without skipping workflow or export gates. */
export function pipelineDrop(card: Card, stage: PipelineStage, data: Snapshot): PipelineDrop {
  const blocked = (label: string): PipelineDrop => ({ kind: 'blocked', label });
  if (card.owner || data.runs.some((run) => run.cardId === card.id && run.status === 'running'))
    return blocked('Wait for the active run to finish.');
  if (stage.states.includes(card.state)) return blocked('Already in this group.');
  if (stage.id === 'shortlisted' && transitions[card.state].includes('shortlisted'))
    return { kind: 'move', state: 'shortlisted', label: 'Drop to shortlist' };
  if (stage.id === 'drafts') {
    if (transitions[card.state].includes('changes_requested'))
      return { kind: 'move', state: 'changes_requested', label: 'Drop to request changes' };
    if (card.state === 'shortlisted') {
      if (!data.profile.some((file) => file.content.trim()))
        return blocked('Add profile notes before drafting.');
      const writers = data.roles.filter(
        (role) => !role.retiredAt && role.enabled && workflowSeat(role) === 'writer',
      );
      const available = writers.filter((role) =>
        data.runtimes.some((runtime) => runtime.id === role.runtime && runtime.available),
      );
      const writer = available.find(
        (role) => !data.runs.some((run) => run.roleId === role.id && run.status === 'running'),
      );
      if (!writer)
        return blocked(
          available.length
            ? 'Wait for your Writer to finish.'
            : 'Enable an available Writer in Crew.',
        );
      return { kind: 'run', roleId: writer.id, label: `Drop to start ${writer.name}` };
    }
    return blocked('Shortlist this job before drafting.');
  }
  if (stage.id === 'applied') {
    if (!transitions[card.state].includes('submitted'))
      return blocked('Review, approve and export the packet first.');
    const exported = data.approvals.some(
      (approval) =>
        approval.cardId === card.id &&
        approval.status === 'consumed' &&
        approval.exportDirectory &&
        card.packet &&
        JSON.stringify(approval.packet) === JSON.stringify(card.packet),
    );
    return exported
      ? { kind: 'move', state: 'submitted', label: 'Drop to record manual submission' }
      : blocked('Approve and export the current packet first.');
  }
  return blocked(
    stage.id === 'ready'
      ? 'The crew must finish reviewing the packet.'
      : `This job has passed ${stage.label}.`,
  );
}

export function canDragJob(card: Card, data: Snapshot) {
  return stages.some((stage) => pipelineDrop(card, stage, data).kind !== 'blocked');
}
