import type { Skill } from './skills.ts';

/** Immutable upstream identity; fetchedAt and local customizations do not define a version. */
export const skillSourceRevision = (source: NonNullable<Skill['source']>): string => {
  return `${source.repository.toLowerCase()}:${source.path}:${source.blobSha}`;
};

export const hasSkillUpdate = (check: SkillUpdateCheck): boolean => {
  return Boolean(
    check.latest && skillSourceRevision(check.latest) !== skillSourceRevision(check.installed),
  );
};

export const isPendingSkillUpdate = (check: SkillUpdateCheck): boolean => {
  return hasSkillUpdate(check) && check.dismissedRevision !== skillSourceRevision(check.latest!);
};

export const skillUpdateCheckInterval = 24 * 60 * 60 * 1000;

export interface SkillUpdateCheck {
  skillId: string;
  installed: NonNullable<Skill['source']>;
  checkedAt: string;
  successfulAt?: string;
  error?: string;
  latest?: NonNullable<Skill['source']>;
  detectedAt?: string;
  dismissedRevision?: string;
}
export interface SkillUpdatesState {
  automatic: boolean;
  checking: boolean;
  checks: SkillUpdateCheck[];
}
