import { ChartNoAxesColumnIncreasing, FileText, Search, ShieldCheck } from 'lucide-react';

export const stages = [
  {
    id: 'fit',
    label: 'Fit',
    role: 'scout',
    icon: Search,
    description: 'See how well you match',
    title: 'Scout checks the fit first.',
    summary:
      'Scout compares the posting with your background, scores the match and names what’s missing. You decide what to shortlist, and confirm the job brief the crew will work from.',
  },
  {
    id: 'draft',
    label: 'Draft',
    role: 'writer',
    icon: FileText,
    description: 'Tailor your application',
    title: 'Writer drafts from your notes.',
    summary:
      'Writer prepares a resume, cover letter and form answers from your profile notes and the confirmed brief. Every claim quotes your own words.',
  },
  {
    id: 'review',
    label: 'Review',
    role: 'reviewer',
    icon: ShieldCheck,
    description: 'Check every claim',
    title: 'Reviewer checks, you approve.',
    summary:
      'Reviewer reads the whole packet against your notes and packet rules. You choose Markdown, PDF or DOCX and approve the exact files before they’re exported.',
  },
  {
    id: 'track',
    label: 'Track',
    role: 'you',
    icon: ChartNoAxesColumnIncreasing,
    description: 'Follow it after you apply',
    title: 'Keep track and learn.',
    summary:
      'Record where you applied, follow the status as replies come in, and note what you learned. Insights shows what’s working across your search.',
  },
] as const;

export type JourneyStage = (typeof stages)[number];
