import { capabilityLabels } from '../agent-capabilities.ts';
import { runtimeLabels } from '../lib/labels.ts';
import { assignedSkills } from './helpers.ts';
import { workflowOptions } from './constants.ts';
import type { CreationDraft } from './types.ts';
import type { Snapshot } from '@pitchcrew/core';
import { draftInput, scheduleLabel } from '../RoutinesPage/helpers.ts';

export function reviewSections(draft: CreationDraft, data: Snapshot) {
  const role = draft.role;
  const permissions = Object.entries(capabilityLabels).filter(
    ([key]) => role.capabilities?.[key as keyof typeof role.capabilities],
  );
  return [
    {
      title: 'Purpose',
      text: `${role.name} (${role.id})\n${role.description}\n${workflowOptions.find((option) => option.value === role.workflow)?.label}\n${role.instructions || 'No additional instructions.'}`,
    },
    {
      title: 'Runtime',
      text: `${runtimeLabels[role.runtime]} · ${role.runtime === 'demo' ? 'Scripted (no AI calls)' : role.model || 'CLI default'}\nStarts ${role.enabled ? 'enabled' : 'paused'}.`,
    },
    {
      title: 'Tools',
      text:
        permissions.map(([, label]) => label).join('\n') ||
        'Chat, local profile and assigned skills. No additional permissions.',
    },
    {
      title: 'Skills',
      text:
        assignedSkills(draft, data)
          .map((skill) => `${skill.name}${skill.scope === 'all' ? ' (shared)' : ''}`)
          .join('\n') || 'No assigned skills.',
    },
    {
      title: 'Routine',
      text: routineReview(draft, data),
    },
  ];
}
function routineReview(draft: CreationDraft, data: Snapshot): string {
  if (!draft.scheduled) return 'Start work in chat. No routine will be created.';
  const routine = draft.routine;
  const job = data.cards.find((card) => card.id === routine.cardId);
  return [
    routine.name,
    routine.content,
    scheduleLabel(draftInput({ ...routine, roleId: draft.role.id })),
    `Starts ${routine.startLocal} (${routine.timezone}).`,
    routine.enabled ? 'Enabled' : 'Paused',
    routine.maxRuns ? `Stop after ${routine.maxRuns} runs.` : '',
    routine.endLocal ? `Ends ${routine.endLocal}.` : '',
    job ? `Attached to ${job.company} — ${job.title}.` : 'No job attached.',
  ]
    .filter(Boolean)
    .join('\n');
}
