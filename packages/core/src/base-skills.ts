// Kept free of schema dependencies so the browser can render the catalog directly.
import type { RoleId } from './states.ts';
export const skillContentLimit = 50000;
export interface BaseSkill {
  name: string;
  description: string;
  source: string;
  sourceAliases?: string[];
  sourceType: 'github';
  skillPath: string;
  defaultRoles: RoleId[];
  note?: string;
}
export const baseSkills: BaseSkill[] = [
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
  return `https://skills.sh/${skill.source}/${skill.name}`;
}
