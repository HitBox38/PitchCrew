import type { Role, Skill } from '@pitchcrew/core';
import { baseSkills } from '@pitchcrew/core/base-skills';

export const assignment = (skill: Skill, roles: Role[]) => {
  const roleIds = new Set(skill.roleIds);
  return skill.scope === 'all'
    ? 'All agents'
    : roles
        .filter((role) => roleIds.has(role.id))
        .map((role) => role.name)
        .join(', ');
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
