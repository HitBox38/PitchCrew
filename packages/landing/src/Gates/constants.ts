import type { Role } from '../components/clay/Pebble';

export const gates: {
  role: Role;
  actor: string;
  title: string;
  text: string;
  stops: string;
}[] = [
  {
    role: 'writer',
    actor: 'Writer',
    title: 'Quoted',
    text: 'Every claim in your resume, cover letter and answers must quote your profile notes word for word. Personal answers it cannot support wait for you.',
    stops: 'Stops invented experience.',
  },
  {
    role: 'reviewer',
    actor: 'Reviewer',
    title: 'Checked',
    text: 'A separate agent reads the whole packet against your notes and your own packet rules, such as word limits, then agrees or asks for changes.',
    stops: 'Stops unsupported claims and broken rules.',
  },
  {
    role: 'you',
    actor: 'You',
    title: 'Approved',
    text: 'You approve the exact files before they are exported. In the browser, Pitchcrew asks before it submits an application or sends a message, spotting those steps as best it can; you choose how much else asks first.',
    stops: 'Stops unapproved exports and asks before an application goes out.',
  },
];
