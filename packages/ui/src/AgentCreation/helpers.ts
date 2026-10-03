import { isRoleId } from '@pitchcrew/core/states';
import type { Role, Snapshot } from '@pitchcrew/core';
import { draftInput, initialDraft } from '../RoutinesPage/helpers.ts';
import { newAgentCapabilities } from './constants.ts';
import type { CreationDraft } from './types.ts';

export function suggestedId(name: string, roles: Role[]): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42)
    .replace(/-+$/g, '');
  const base = isRoleId(slug) ? slug : 'new-agent';
  let id = base;
  for (let n = 2; roles.some((role) => role.id === id); n++) id = `${base}-${n}`;
  return id;
}
export function initialCreation(data: Snapshot): CreationDraft {
  return {
    role: {
      id: '',
      name: '',
      description: '',
      instructions: '',
      runtime:
        data.runtimes.find((runtime) => runtime.available && runtime.id !== 'demo')?.id ??
        data.runtimes[0]?.id ??
        'claude-code',
      model: '',
      workflow: 'chat',
      enabled: true,
      capabilities: { ...newAgentCapabilities },
    },
    skills: [],
    scheduled: false,
    routine: { ...initialDraft(null), roleId: '', enabled: false },
  };
}
export function assignedSkills(draft: CreationDraft, data: Snapshot) {
  return data.skills.filter(
    (skill) =>
      !skill.deletedAt &&
      (skill.scope === 'all' || draft.skills.some((reference) => reference.id === skill.id)),
  );
}
export function skillSize(draft: CreationDraft, data: Snapshot) {
  return assignedSkills(draft, data).reduce(
    (size, skill) => size + skill.name.length + skill.description.length + skill.content.length,
    0,
  );
}
export function creationInput(draft: CreationDraft) {
  return {
    ...draft.role,
    skills: draft.skills,
    ...(draft.scheduled
      ? { routine: draftInput({ ...draft.routine, roleId: draft.role.id }) }
      : {}),
  };
}
export function stepError(step: number, draft: CreationDraft, data: Snapshot): string {
  const { role } = draft;
  if (step === 0) {
    if (!role.name.trim() || !role.description.trim())
      return 'Add a name and responsibilities for this agent.';
    if (!isRoleId(role.id))
      return 'Use a safe lowercase ID with letters, numbers and single hyphens, up to 48 characters.';
    if (data.roles.some((item) => item.id === role.id))
      return 'This ID belongs to an existing or retired role. Choose another ID.';
    if (data.roles.length >= 50) return 'You can store up to 50 roles.';
  }
  if (
    step === 1 &&
    role.enabled &&
    !data.runtimes.some((runtime) => runtime.id === role.runtime && runtime.available)
  )
    return 'Choose an available runtime or pause the agent until its runtime is installed.';
  if (step === 3) {
    if (
      draft.skills.some(
        (reference) =>
          !data.skills.some(
            (skill) =>
              !skill.deletedAt &&
              skill.id === reference.id &&
              skill.updatedAt === reference.updatedAt,
          ),
      )
    )
      return 'A selected skill changed or was removed. Deselect it and review the current version.';
    if (skillSize(draft, data) > 60000)
      return 'Assigned skills must total at most 60,000 characters.';
  }
  if (step === 4 && draft.scheduled) {
    if (!draft.routine.name.trim() || !draft.routine.content.trim())
      return 'Give the routine a name and an action.';
    try {
      creationInput(draft);
    } catch (error) {
      return error instanceof Error ? error.message : 'Check the schedule.';
    }
  }
  return '';
}
export function setupWarnings(draft: CreationDraft, data: Snapshot): string[] {
  const caps = draft.role.capabilities ?? newAgentCapabilities;
  const warnings: string[] = [];
  if (!draft.role.enabled)
    warnings.push('This agent starts paused. Enable it in settings when ready.');
  if (draft.role.runtime === 'demo')
    warnings.push(
      'Demo uses deterministic replies. Choose an installed runtime for live agent work.',
    );
  if (caps.trackApplications && !caps.gmail)
    warnings.push('Email reconciliation needs Gmail access.');
  if (caps.proposeCrewChanges && !caps.reviewPipeline)
    warnings.push('Crew change proposals need pipeline review access.');
  if ((caps.assessForms || caps.recordSubmissions) && !caps.computerUse)
    warnings.push('Form assessment and submission recording need browser access.');
  if (caps.maintainProfile)
    warnings.push(
      'Profile maintenance needs watched sources in Profile and access to their GitHub or Drive service.',
    );
  for (const service of ['github', 'gmail', 'drive', 'calendar', 'sheets'] as const)
    if (
      caps[service] &&
      !data.connectors.some((account) => account.connected && account.services.includes(service))
    )
      warnings.push(
        `Connect ${service === 'github' ? 'GitHub' : 'Google'} in Crew settings before using ${{ github: 'GitHub', gmail: 'Gmail', drive: 'Drive', calendar: 'Calendar', sheets: 'Sheets' }[service]}.`,
      );
  if (draft.scheduled)
    warnings.push(
      draft.routine.enabled
        ? 'The routine runs while Pitchcrew is open. Each turn can use your configured runtime and spend provider tokens.'
        : 'The first routine starts paused. Enable it on the Routines page when ready.',
    );
  return [...new Set(warnings)];
}
