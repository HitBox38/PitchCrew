import type { Packet, ProfileFile } from '@pitchcrew/core';

export const profile: ProfileFile[] = [
  {
    name: 'work.md',
    content:
      '# Alex Morgan\n\n- Built accessible React interfaces for scheduling.\n- Reduced dashboard render time by 30%.\n',
  },
  {
    name: 'projects.md',
    content: '# Projects\n\n- Created a TypeScript editor for branching stories.\n',
  },
];
export const packet: Packet = {
  resume:
    '# Alex Morgan\n\nBuilt accessible React interfaces for scheduling.\nReduced dashboard render time by 30%.',
  coverLetter:
    'I am interested in this frontend role. Created a TypeScript editor for branching stories.',
  formAnswers: 'Available for remote work.',
  note: 'Review compensation with the hiring team.',
  claims: [
    {
      claim: 'Built accessible React interfaces for scheduling.',
      source: 'work.md',
      quote: 'Built accessible React interfaces for scheduling.',
    },
    {
      claim: 'Reduced dashboard render time by 30%.',
      source: 'work.md',
      quote: 'Reduced dashboard render time by 30%.',
    },
    {
      claim: 'Created a TypeScript editor for branching stories.',
      source: 'projects.md',
      quote: 'Created a TypeScript editor for branching stories.',
    },
  ],
};
