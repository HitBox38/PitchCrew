import type { BaseSkill } from '../../base-skills.ts';
import { companyResearch } from './company-research.ts';
import { linkedInDrafting } from './linkedin-drafting.ts';

export const hunterSkills: BaseSkill[] = [
  { skill: companyResearch, file: 'company-research', roles: ['scout', 'career-coach'] },
  { skill: linkedInDrafting, file: 'linkedin-drafting', roles: ['career-coach'] },
].map(({ skill, file, roles }) => ({
  ...skill,
  source: 'Pitchcrew',
  sourceType: 'bundled',
  skillPath: `src/starter-skills/hunter/${file}.ts`,
  defaultRoles: roles,
  note: 'Included offline. Adapted from Hunter for Pitchcrew; updates ship through reviewed releases.',
}));
