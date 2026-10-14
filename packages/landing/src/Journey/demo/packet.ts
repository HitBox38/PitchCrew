import type { DemoCard } from '../types';

const lines = [
  'Built accessible React and TypeScript interfaces for a scheduling product.',
  'Created reusable UI components and documented their interaction patterns.',
  'Improved application responsiveness by profiling rendering and reducing unnecessary updates.',
  'Collaborated with designers and backend engineers to ship product features.',
];

export const packet: NonNullable<DemoCard['packet']> = {
  resume: `# Alex Morgan (example candidate)\n\n## Application for Design Engineer\n\n${lines.map((line) => `- ${line}`).join('\n')}`,
  coverLetter: `Dear Forma team,\n\nI am interested in the Design Engineer opportunity.\n\n${lines.slice(0, 3).join('\n\n')}\n\nI would welcome a conversation about the role.\n\nAlex Morgan`,
  formAnswers: 'Availability and compensation: confirm with the candidate before applying.',
  note: 'Application packet for Forma. Review the source-backed experience and personalize this draft before using it.',
  claims: lines.map((line) => ({ claim: line, quote: line, source: 'experience.md' })),
};
