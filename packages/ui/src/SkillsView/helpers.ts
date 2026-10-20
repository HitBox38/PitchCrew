import type { Role, Skill } from '@pitchcrew/core';
import { baseSkills } from '@pitchcrew/core/base-skills';

export const assignment = (skill: Skill, roles: Role[]) => {
  return skill.scope === 'all'
    ? 'All agents'
    : roles
        .filter((role) => skill.roleIds.includes(role.id))
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
