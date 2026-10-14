import { PenLine, ShieldCheck, UserCheck } from 'lucide-react';

export const gates = [
  {
    role: 'writer',
    actor: 'Writer',
    icon: PenLine,
    title: 'Quoted',
    text: 'Every claim in your resume, cover letter and answers must quote your profile notes word for word. Personal answers it can’t support wait for you.',
    stops: 'Stops invented experience.',
  },
  {
    role: 'reviewer',
    actor: 'Reviewer',
    icon: ShieldCheck,
    title: 'Checked',
    text: 'A separate agent reads the whole packet against your notes and your own packet rules, like word limits, then agrees or asks for changes.',
    stops: 'Stops unsupported claims and broken rules.',
  },
  {
    role: 'you',
    actor: 'You',
    icon: UserCheck,
    title: 'Approved',
    text: 'You approve the exact files before they are exported. In the browser, every submit, button press and dialog waits for your decision.',
    stops: 'Stops anything being sent without you.',
  },
] as const;
