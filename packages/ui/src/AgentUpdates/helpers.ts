import type { Snapshot } from '@pitchcrew/core';
import { skillUpdateCheckInterval } from '@pitchcrew/core/skill-updates';

/** Reopening before a daily check is due must not postpone it by another full day. */
export function nextSkillCheckDelay(data: Snapshot | null, now = Date.now()) {
  const checks = new Map(data?.skillUpdates?.checks.map((check) => [check.skillId, check]));
  const due =
    data?.skills
      .filter((skill) => skill.source)
      .map((skill) => {
        const checkedAt = checks.get(skill.id)?.checkedAt;
        return checkedAt ? Date.parse(checkedAt) + skillUpdateCheckInterval - now : 0;
      }) ?? [];
  // A failed daemon request has no new checkpoint: back off instead of hammering it.
  return Math.max(60_000, Math.min(skillUpdateCheckInterval, ...due));
}
