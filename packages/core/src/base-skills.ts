import { deepResumeReviewSkill } from './starter-skills/deep-resume-review.ts';
// Kept free of schema dependencies so the browser can render the catalog directly.
import type { RoleId } from './states.ts';
import { improveSystem } from './starter-skills/improve-system.ts';
import { promptInjectionGuard } from './starter-skills/prompt-injection-guard.ts';
import { careerSkills } from './starter-skills/career-ops/index.ts';
import { hunterSkills } from './starter-skills/hunter/index.ts';

export const skillContentLimit = 50000;
interface BaseSkillMetadata {
  name: string;
  description: string;
  source: string;
  sourceAliases?: string[];
  skillPath: string;
  defaultRoles: RoleId[];
  defaultScope?: 'all' | 'roles';
  note?: string;
}
export type BaseSkill = BaseSkillMetadata &
  ({ sourceType: 'github' } | { sourceType: 'bundled'; content: string });
export const baseSkills: BaseSkill[] = [
  ...careerSkills,
  ...hunterSkills,
  {
    ...deepResumeReviewSkill,
    source: 'Pitchcrew',
    sourceType: 'bundled',
    skillPath: 'src/starter-skills/deep-resume-review.ts',
    defaultRoles: ['reviewer'],
    note: 'Uses the managed deep-review flow. Subagents depend on runtime support.',
  },
  {
    ...promptInjectionGuard,
    source: 'Pitchcrew',
    sourceType: 'bundled',
    skillPath: 'src/starter-skills/prompt-injection-guard.ts',
    defaultScope: 'all',
    defaultRoles: [],
    note: 'Included with Pitchcrew and available offline. Supplements the enforced safety checks.',
  },
  {
    ...improveSystem,
    source: 'Pitchcrew',
    sourceType: 'bundled',
    skillPath: 'src/starter-skills/improve-system.ts',
    defaultRoles: ['pipeline-coach'],
    note: 'Included offline for Pipeline Coach. Adapts improve-system to board evidence and user-reviewed proposals.',
  },
  {
    name: 'cover-letter',
    defaultRoles: ['writer'],
    description: 'Draft a cover letter tailored to the role and your experience.',
    source: 'claude-office-skills/skills',
    sourceType: 'github',
    skillPath: 'cover-letter/SKILL.md',
  },
  {
    name: 'humanizer',
    defaultRoles: ['reviewer'],
    description: 'Edit prose for natural language and fewer AI writing patterns.',
    source: 'blader/humanizer',
    sourceType: 'github',
    skillPath: 'SKILL.md',
  },
  {
    name: 'resume-bullet-writer',
    defaultRoles: ['writer'],
    description: 'Turn experience into resume bullets that explain achievements and impact.',
    source: 'paramchoudhary/resumeskills',
    sourceType: 'github',
    skillPath: 'skills/resume-bullet-writer/SKILL.md',
  },
  {
    name: 'unslop',
    defaultRoles: ['writer'],
    description: 'Remove stock phrases and repetitive patterns while preserving meaning.',
    source: 'cursor/plugins',
    sourceType: 'github',
    skillPath: 'pstack/skills/unslop/SKILL.md',
  },
  {
    name: 'view-pdf',
    defaultRoles: ['reviewer'],
    description: 'Guide interactive PDF viewing, annotations and form review.',
    source: 'anthropics/knowledge-work-plugins',
    sourceType: 'github',
    skillPath: 'pdf-viewer/skills/view-pdf/SKILL.md',
    note: 'Requires PDF viewer tooling. Adding these instructions does not enable a PDF viewer in Pitchcrew.',
  },
  {
    name: 'article-writing',
    defaultRoles: ['writer'],
    description:
      'Develop longer pieces with a consistent voice, structure and supporting evidence.',
    source: 'affaan-m/ECC',
    sourceAliases: ['affaan-m/everything-claude-code'],
    sourceType: 'github',
    skillPath: 'skills/article-writing/SKILL.md',
  },
  {
    name: 'grilling',
    defaultRoles: ['scout'],
    description: 'Explore a plan or decision through focused rounds of questions.',
    source: 'mattpocock/skills',
    sourceType: 'github',
    skillPath: 'skills/productivity/grilling/SKILL.md',
  },
  {
    name: 'research',
    defaultRoles: ['scout'],
    description: 'Investigate a question using primary sources and capture the findings.',
    source: 'mattpocock/skills',
    sourceType: 'github',
    skillPath: 'skills/engineering/research/SKILL.md',
  },
  {
    name: 'writing-fragments',
    defaultRoles: ['writer'],
    description: 'Gather ideas and raw material before choosing a structure.',
    source: 'mattpocock/skills',
    sourceType: 'github',
    skillPath: 'skills/in-progress/writing-fragments/SKILL.md',
  },
  {
    name: 'writing-shape',
    defaultRoles: ['writer'],
    description: 'Organize raw material into a piece, paragraph by paragraph.',
    source: 'mattpocock/skills',
    sourceType: 'github',
    skillPath: 'skills/in-progress/writing-shape/SKILL.md',
  },
];
export function baseSkillUrl(skill: BaseSkill) {
  return skill.sourceType === 'github' ? `https://skills.sh/${skill.source}/${skill.name}` : '';
}
