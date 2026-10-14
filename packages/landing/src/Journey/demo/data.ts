import type { DemoBrief, DemoCard, DemoDocument, DemoEvent, DemoTab } from '../types';
import { packet } from './packet';

const created = '2026-10-06T09:00:00.000Z';

const base: DemoCard = {
  id: 'forma-demo',
  company: 'Forma',
  title: 'Design Engineer',
  location: 'Berlin · Hybrid',
  url: '',
  salary: '€80k–€100k',
  description: 'Fictional example job.',
  tags: ['Design systems', 'React'],
  state: 'shortlisted',
  fit: 85,
  owner: null,
  packet: null,
  feedback: [],
  createdAt: created,
  updatedAt: created,
  sample: true,
};

export const brief: DemoBrief = {
  brief: {
    companyContext: 'Forma makes design tools for small product teams. Fictional demo employer.',
    responsibilities: [
      'Own the design system with product designers.',
      'Build accessible interfaces.',
    ],
    qualifications: ['React and TypeScript.', 'Experience documenting components.'],
    constraints: ['Hybrid, two days a week in Berlin.'],
  },
  requirements: [],
  flagged: [],
};

interface StageView {
  card: DemoCard;
  runRole: string | null;
  tab: DemoTab;
  document: DemoDocument;
  /** Newest history event that has happened by this stage. */
  history: number;
}

export const views: Record<'fit' | 'draft' | 'review' | 'track', StageView> = {
  fit: { card: base, runRole: 'writer', tab: 'overview', document: 'resume', history: 1 },
  draft: {
    card: { ...base, state: 'in_review', packet },
    runRole: 'reviewer',
    tab: 'packet',
    document: 'resume',
    history: 2,
  },
  review: {
    card: { ...base, state: 'agreed', packet },
    runRole: null,
    tab: 'packet',
    document: 'coverLetter',
    history: 3,
  },
  track: {
    card: { ...base, state: 'interviewing', packet },
    runRole: null,
    tab: 'history',
    document: 'resume',
    history: 6,
  },
};

const event = (id: number, actor: string, message: string, day: number): DemoEvent =>
  ({
    id,
    version: 20,
    kind: 'card',
    entityId: base.id,
    actor,
    message,
    data: {},
    createdAt: `2026-10-${String(day).padStart(2, '0')}T10:00:00.000Z`,
  }) as DemoEvent;

export const events: DemoEvent[] = [
  event(6, 'user', 'Moved to interviewing', 13),
  event(5, 'user', 'Recorded your submission', 10),
  event(4, 'user', 'Approved the export', 9),
  event(3, 'reviewer', 'Reviewer agreed: every claim quotes your notes', 8),
  event(2, 'writer', 'Writer drafted the packet', 8),
  event(1, 'scout', 'Scout scored the fit: 85%', 6),
];
