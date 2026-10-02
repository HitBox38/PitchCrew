// Kept free of schema dependencies so the browser can render the catalog directly.
export const skillContentLimit = 50000;
export interface BaseSkill {
  name: string;
  description: string;
  source: string;
  sourceType: 'github';
  skillPath: string;
  computedHashes: string[];
  note?: string;
  unavailable?: boolean;
}
// Supplied lockfile hashes are reference metadata, not verified hashes of current upstream files.
export const baseSkills: BaseSkill[] = [
  {
    name: 'cover-letter',
    description: 'Draft a cover letter tailored to the role and your experience.',
    source: 'claude-office-skills/skills',
    sourceType: 'github',
    skillPath: 'cover-letter/SKILL.md',
    computedHashes: ['e5d2de685d987af7201eb65e7bbfe7f057fcc2b210cc9c099ab6a8f43273e215'],
  },
  {
    name: 'humanizer',
    description: 'Edit prose for natural language and fewer AI writing patterns.',
    source: 'blader/humanizer',
    sourceType: 'github',
    skillPath: 'SKILL.md',
    computedHashes: [
      '3479992308a89a652bd1e12d0f612dd00d02d845e166ab51f0caaafc9300a5e7',
      '44201a7ac488b5147fde0a8a63aeb1ffd1501f384d525fd3c482f9599c4903f4',
    ],
  },
  {
    name: 'resume-bullet-writer',
    description: 'Turn experience into resume bullets that explain achievements and impact.',
    source: 'paramchoudhary/resumeskills',
    sourceType: 'github',
    skillPath: 'skills/resume-bullet-writer/SKILL.md',
    computedHashes: ['11ebdcc68f04e474db16c52b134b21c0f71f065913ffcbb8176004311cd412f7'],
  },
  {
    name: 'unslop',
    description: 'Remove stock phrases and repetitive patterns while preserving meaning.',
    source: 'cursor/plugins',
    sourceType: 'github',
    skillPath: 'pstack/skills/unslop/SKILL.md',
    computedHashes: ['d8593c3deff559acd5933ebb3023dab22c939b9adcac5deda75beeb0277342a0'],
  },
  {
    name: 'view-pdf',
    description: 'Guide interactive PDF viewing, annotations and form review.',
    source: 'anthropics/knowledge-work-plugins',
    sourceType: 'github',
    skillPath: 'pdf-viewer/skills/view-pdf/SKILL.md',
    computedHashes: ['3b5f99f6b143eef94df0c20eb98972d2e77f53f4682e308dfe21035771cee3b0'],
    note: 'Requires PDF viewer tooling. Adding these instructions does not enable a PDF viewer in Pitchcrew.',
  },
  {
    name: 'article-writing',
    description:
      'Develop longer pieces with a consistent voice, structure and supporting evidence.',
    source: 'affaan-m/everything-claude-code',
    sourceType: 'github',
    skillPath: 'skills/article-writing/SKILL.md',
    computedHashes: ['728cf7d0c32b65162d86133a8351398657207dad5d8ef68d031d4a5934a0d4df'],
  },
  {
    name: 'edit-article',
    description: 'A starting point for reviewing and editing an article.',
    source: 'mattpocock/skills',
    sourceType: 'github',
    skillPath: 'skills/personal/edit-article/SKILL.md',
    computedHashes: ['8d7aec1987245a27e9c7d585b9f11d1129b8bd8ecb3a8596cdd3048974d9e302'],
    note: 'The supplied file is currently missing from its upstream repository.',
    unavailable: true,
  },
  {
    name: 'grilling',
    description: 'Explore a plan or decision through focused rounds of questions.',
    source: 'mattpocock/skills',
    sourceType: 'github',
    skillPath: 'skills/productivity/grilling/SKILL.md',
    computedHashes: ['bf1e75d96966edd298902d63348c828921b8b095d7306d0cdd56b4a591a7a82b'],
  },
  {
    name: 'research',
    description: 'Investigate a question using primary sources and capture the findings.',
    source: 'mattpocock/skills',
    sourceType: 'github',
    skillPath: 'skills/engineering/research/SKILL.md',
    computedHashes: ['87d17f5103899fbe179b552a85485d50f2316ca5b3128f5716af7d88817533e1'],
  },
  {
    name: 'writing-fragments',
    description: 'Gather ideas and raw material before choosing a structure.',
    source: 'mattpocock/skills',
    sourceType: 'github',
    skillPath: 'skills/in-progress/writing-fragments/SKILL.md',
    computedHashes: ['394bc75401f55d242ecebb548e9932a211b84423ca25ebe7bbfdebde4f6066ce'],
  },
  {
    name: 'writing-shape',
    description: 'Organize raw material into a piece, paragraph by paragraph.',
    source: 'mattpocock/skills',
    sourceType: 'github',
    skillPath: 'skills/in-progress/writing-shape/SKILL.md',
    computedHashes: ['77007511510c05b602835acdb91a88f435ce5a08a9dbf95ade148f02e4b09548'],
  },
];
export function baseSkillUrl(skill: BaseSkill) {
  return `https://skills.sh/${skill.source}/${skill.name}`;
}
