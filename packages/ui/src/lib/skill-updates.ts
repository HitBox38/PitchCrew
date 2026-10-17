import type { Snapshot } from '@pitchcrew/core';
import { hasSkillUpdate, isPendingSkillUpdate } from '@pitchcrew/core/skill-updates';

export function availableSkillUpdates(data: Snapshot) {
  const ids = new Set(data.skills.filter((skill) => !skill.deletedAt).map((skill) => skill.id));
  return (data.skillUpdates?.checks ?? []).filter(
    (check) => ids.has(check.skillId) && hasSkillUpdate(check),
  );
}

export function pendingSkillUpdates(data: Snapshot) {
  return availableSkillUpdates(data).filter(isPendingSkillUpdate);
}
