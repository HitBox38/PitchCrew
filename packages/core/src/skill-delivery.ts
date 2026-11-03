import type { Skill } from './skills.ts';

/** Invalidate native sessions when instruction delivery changes, even for unchanged skills. */
export const skillDeliveryVersion = 1;

/** Saved skills predating delivery settings keep their original full inclusion. */
export const skillIncludedEveryRun = (skill: Pick<Skill, 'includeInEveryRun'>): boolean =>
  skill.includeInEveryRun !== false;

/** Only assigned snapshots supply content, including for explicitly selected skills. */
export const skillDelivery = (
  skills: readonly Skill[],
  selected: readonly Pick<Skill, 'id'>[] = [],
): { included: Skill[]; available: Skill[] } => {
  const chosen = new Set(selected.map((skill) => skill.id));
  const included: Skill[] = [];
  const available: Skill[] = [];
  const seen = new Set<string>();
  for (const skill of skills) {
    if (seen.has(skill.id)) continue;
    seen.add(skill.id);
    (skillIncludedEveryRun(skill) || chosen.has(skill.id) ? included : available).push(skill);
  }
  return { included, available };
};
