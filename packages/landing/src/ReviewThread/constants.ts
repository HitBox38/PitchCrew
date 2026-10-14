import type { Claim } from './types';

export const profileFile = 'experience.md';

export const claims: Claim[] = [
  {
    id: 'interfaces',
    text: 'Built accessible React and TypeScript interfaces for a scheduling product.',
    line: 6,
    verdict: 'quoted',
    note: 'Matches your notes word for word.',
  },
  {
    id: 'components',
    text: 'Created reusable UI components and documented their interaction patterns.',
    line: 7,
    verdict: 'quoted',
    note: 'Matches your notes word for word.',
  },
  {
    id: 'performance',
    text: 'Improved application responsiveness by profiling rendering and reducing unnecessary updates.',
    line: 8,
    verdict: 'quoted',
    note: 'Matches your notes word for word. Fast, accessible interfaces are what the brief asks for.',
  },
  {
    id: 'collaboration',
    text: 'Collaborated with designers and backend engineers to ship product features.',
    line: 11,
    verdict: 'revised',
    draft: 'Owned the company’s design system end to end.',
    note: 'Requested a change: the first draft was not in your notes. Writer replaced it with your own line.',
  },
];

export const initialClaim = 'components';
