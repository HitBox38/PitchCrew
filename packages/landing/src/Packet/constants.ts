import type { Claim } from './types';

export const profileFile = 'experience.md';

export const claims: Claim[] = [
  {
    id: 'interfaces',
    text: 'Built accessible React and TypeScript interfaces for a scheduling product.',
    line: 6,
    verdict: 'quoted',
    quote: 'Built accessible React and TypeScript interfaces for a scheduling product.',
    note: 'Matches your notes word for word.',
  },
  {
    id: 'components',
    text: 'Created reusable UI components and documented their interaction patterns.',
    line: 7,
    verdict: 'quoted',
    quote: 'Created reusable UI components and documented their interaction patterns.',
    note: 'Matches your notes word for word, and it answers the brief’s “documented components” line.',
  },
  {
    id: 'performance',
    text: 'Improved application responsiveness by profiling rendering and reducing unnecessary updates.',
    line: 8,
    verdict: 'quoted',
    quote:
      'Improved application responsiveness by profiling rendering and reducing unnecessary updates.',
    note: 'Matches your notes word for word.',
  },
  {
    id: 'collaboration',
    text: 'Collaborated with designers and backend engineers to ship product features.',
    line: 11,
    verdict: 'revised',
    quote: 'Collaborated with designers and backend engineers to ship product features.',
    draft: 'Owned the company’s design system end to end.',
    note: 'The first draft was not in your notes, so I asked for a change. Writer replaced it with your own line.',
  },
];

export const initialClaim = 'components';
