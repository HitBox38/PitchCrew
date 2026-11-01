import type { Role, RoleId, Skill, Snapshot } from '@pitchcrew/core';
import { baseSkills } from '@pitchcrew/core/base-skills';
import type { SkillFilter } from './types.ts';

export const assignment = (skill: Skill, roles: Role[]) => {
  const roleIds = new Set(skill.roleIds);
  return skill.scope === 'all'
    ? 'All agents'
    : roles
        .filter((role) => roleIds.has(role.id))
        .map((role) => role.name)
        .join(', ');
};

/** Roles a role-scoped skill is assigned to, in crew order; shared skills return none. */
export const assignedRoles = (skill: Skill, roles: Role[]) => {
  const roleIds = new Set(skill.roleIds);
  return skill.scope === 'all' ? [] : roles.filter((role) => roleIds.has(role.id));
};

export const starterNote = (skill: Skill) => {
  return baseSkills.find((item) =>
    item.sourceType === 'bundled'
      ? item.name === skill.bundledId
      : item.source === skill.source?.repository && item.skillPath === skill.source.path,
  )?.note;
};

export const skillEditorKey = (editing: Skill | string, starter: { name: string } | null) => {
  if (typeof editing !== 'string') return editing.id;
  return editing === 'import' ? (starter?.name ?? editing) : editing;
};

/** Starter failures often share one cause, such as a rate limit; show each reason once. */
export const groupedStarterErrors = (errors: { name: string; error: string }[]) => {
  const groups = new Map<string, string[]>();
  for (const { name, error } of errors) groups.set(error, [...(groups.get(error) ?? []), name]);
  return [...groups].map(([error, names]) => ({ error, names }));
};

/** Library filtering: agent/shared assignment, pending updates and free-text search. */
export const skillMatches = (
  skill: Skill,
  {
    filter,
    query,
    updatesOnly,
    pending,
    creator,
  }: {
    filter: SkillFilter;
    query: string;
    updatesOnly: boolean;
    pending: Set<string>;
    creator: string;
  },
) => {
  if (updatesOnly && !pending.has(skill.id)) return false;
  if (filter === 'shared' && skill.scope !== 'all') return false;
  if (filter !== 'all' && filter !== 'shared' && skill.scope !== 'all') {
    if (!skill.roleIds.includes(filter)) return false;
  }
  return `${skill.name} ${skill.description} ${skill.content} ${creator} ${skill.source?.repository ?? ''}`
    .toLowerCase()
    .includes(query.trim().toLowerCase());
};

/** One assignment chip toggles: All agents switches scope; an agent chip adds or removes it. */
export const toggleAssignment = (
  current: { scope: 'all' | 'roles'; roleIds: RoleId[] },
  target: RoleId | 'all',
): { scope: 'all' | 'roles'; roleIds: RoleId[] } => {
  if (target === 'all') return { ...current, scope: current.scope === 'all' ? 'roles' : 'all' };
  if (current.scope === 'all') return { scope: 'roles', roleIds: [target] };
  return {
    scope: 'roles',
    roleIds: current.roleIds.includes(target)
      ? current.roleIds.filter((id) => id !== target)
      : [...current.roleIds, target],
  };
};

export const latestSuccessfulCheck = (checks: { successfulAt?: string | null }[]) => {
  return checks
    .map((check) => check.successfulAt)
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1);
};

/** Made by: the GitHub owner for imports, Pitchcrew for bundled starters, the proposing agent or You. */
export const skillCreators = (data: Pick<Snapshot, 'skillProposals' | 'roles'>) => {
  const agentCreators = new Map(
    data.skillProposals
      .filter((proposal) => proposal.status === 'applied' && proposal.skillId)
      .map((proposal) => [
        proposal.skillId,
        data.roles.find((role) => role.id === proposal.roleId)?.name ?? proposal.roleId,
      ]),
  );
  return (skill: Skill) =>
    skill.source?.repository.split('/')[0] ??
    (skill.bundledId ? 'Pitchcrew' : (agentCreators.get(skill.id) ?? 'You'));
};
