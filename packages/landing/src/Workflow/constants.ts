import { Compass, PenLine, ScanLine } from 'lucide-react';

export const workflow = [
  {
    name: 'Scout',
    color: 'teal',
    icon: Compass,
    title: 'Find the fit.',
    description:
      'Compare a role with your background. See where you match, what is missing, and whether it is worth your time.',
    output: 'A clearer shortlist',
  },
  {
    name: 'Writer',
    color: 'plum',
    icon: PenLine,
    title: 'Make your case.',
    description:
      'Turn your experience into a tailored resume, cover letter, and form answers. Keep the story grounded in your profile.',
    output: 'An application that sounds like you',
  },
  {
    name: 'Reviewer',
    color: 'blue',
    icon: ScanLine,
    title: 'Give it another look.',
    description:
      'Check the draft against your source notes, spot unsupported claims, and request changes before you export.',
    output: 'A packet ready for your review',
  },
];
