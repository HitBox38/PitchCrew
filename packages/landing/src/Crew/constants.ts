import { ClipboardList, FilePenLine, LineChart, Send } from 'lucide-react';

export const supportCrew = [
  {
    name: 'Submitter',
    icon: Send,
    text: 'prepares application forms in a built-in browser; you approve each submission.',
  },
  {
    name: 'Tracker',
    icon: ClipboardList,
    text: 'keeps statuses current, using Gmail only if you connect it.',
  },
  {
    name: 'Documenter',
    icon: FilePenLine,
    text: 'proposes profile updates from GitHub or Drive folders you choose.',
  },
  {
    name: 'Pipeline Coach',
    icon: LineChart,
    text: 'reviews how the crew is doing and suggests improvements.',
  },
] as const;

export const afterApply = [
  {
    title: 'Track every application.',
    text: 'Drag jobs between stages, record submissions you made elsewhere, and let Tracker match status emails. Anything uncertain waits for you.',
  },
  {
    title: 'Bring your history.',
    text: 'Import past applications from a JSON or CSV export, or a supported older tracker, after a preview.',
  },
  {
    title: 'Find openings.',
    text: 'Scan public Greenhouse, Ashby, Lever, Comeet and Workable boards you save, or paste a posting link.',
  },
  {
    title: 'Learn what works.',
    text: 'Insights shows outcomes by tag, your wins and misses, and the lessons you noted.',
  },
] as const;
