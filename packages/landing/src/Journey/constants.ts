import type { Role } from '../components/clay/Pebble';

export const stages = [
  'Lead',
  'Shortlisted',
  'Drafting',
  'In review',
  'Approval',
  'Submitted',
  'Interviewing',
] as const;

export interface Step {
  id: 'fit' | 'draft' | 'submit' | 'track';
  role: Role;
  /** Index on the stage track this step reaches. */
  reaches: number;
  title: string;
  text: string;
}

export const steps: Step[] = [
  {
    id: 'fit',
    role: 'scout',
    reaches: 1,
    title: 'Scout scores the fit, you shortlist.',
    text: 'Scout compares the posting with your background, scores the match out of 100 and names what is missing. You decide what to shortlist, and you confirm the job brief the crew will work from.',
  },
  {
    id: 'draft',
    role: 'writer',
    reaches: 3,
    title: 'Writer drafts in the open.',
    text: 'Ask for a draft in chat and watch each step: the confirmed brief, your notes, your packet rules. Writer says what it left out and why, and the reply is a packet for Reviewer, not a surprise.',
  },
  {
    id: 'submit',
    role: 'submitter',
    reaches: 5,
    title: 'Submitter fills, you press send.',
    text: 'After you approve the packet, Submitter can prepare the application form in a built-in browser. Every submit, button and dialog is an exact request you approve or deny. Sign-in and CAPTCHAs stay yours.',
  },
  {
    id: 'track',
    role: 'tracker',
    reaches: 6,
    title: 'Tracker keeps the board honest.',
    text: 'Record where you applied, let Tracker match replies when you connect Gmail, and drag the card as things move. Anything uncertain waits for you, and Insights shows what is working.',
  },
];
