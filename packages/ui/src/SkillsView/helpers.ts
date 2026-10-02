import type { Role, Skill } from '@pitchcrew/core';
import { baseSkills } from '@pitchcrew/core/base-skills';

export function assignment(skill: Skill, roles: Role[]) {
  return skill.scope === 'all'
    ? 'All agents'
    : roles
        .filter((role) => skill.roleIds.includes(role.id))
        .map((role) => role.name)
        .join(', ');
}

export function starterNote(skill: Skill) {
  return baseSkills.find(
    (item) => item.source === skill.source?.repository && item.skillPath === skill.source.path,
  )?.note;
}
