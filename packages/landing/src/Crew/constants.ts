import type { Role } from '../components/clay/Pebble';

export const supportCrew: { role: Role; name: string; text: string; state: string }[] = [
  {
    role: 'submitter',
    name: 'Submitter',
    text: 'Prepares application forms in the built-in browser. Every submit waits for you.',
    state: 'Starts paused',
  },
  {
    role: 'documenter',
    name: 'Documenter',
    text: 'Proposes profile updates from GitHub or Drive folders you choose to watch.',
    state: 'Starts paused',
  },
  {
    role: 'pipeline-coach',
    name: 'Pipeline Coach',
    text: 'Reviews how the crew is doing across your applications and proposes changes you approve.',
    state: 'Starts paused',
  },
  {
    role: 'career-coach',
    name: 'Career Coach',
    text: 'Interview practice, offer questions and career plans, in chat, from your own notes.',
    state: 'Starts paused',
  },
];

export const extras = [
  {
    title: 'Find openings.',
    text: 'Scan public Greenhouse, Ashby, Lever, Comeet and Workable boards you save, or paste a posting link.',
  },
  {
    title: 'Bring your history.',
    text: 'Import past applications from a JSON or CSV export, or a supported older tracker, after a preview.',
  },
  {
    title: 'Make your own agent.',
    text: 'Six steps: purpose, runtime, tools, skills, an optional routine and a review. It starts with chat only.',
  },
  {
    title: 'Give them skills.',
    text: 'Markdown instructions you write or import from skills.sh. Skills grant no permissions.',
  },
];
