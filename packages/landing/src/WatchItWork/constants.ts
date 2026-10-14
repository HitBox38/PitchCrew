import type { Activity } from './types';

const start = Date.parse('2026-10-14T09:20:00.000Z');
const at = (seconds: number) => new Date(start + seconds * 1000).toISOString();

function step(
  id: string,
  kind: Activity['kind'],
  label: string,
  from: number,
  to: number,
  text?: string,
): Activity {
  return { id, kind, label, text, status: 'completed', startedAt: at(from), finishedAt: at(to) };
}

export const request =
  'Tailor my resume for this role. Quote only my profile notes and flag anything you can’t support.';

export const job = 'Forma · Design Engineer';

export const turn = {
  startedAt: at(0),
  finishedAt: at(41),
  activity: [
    step(
      'c1',
      'commentary',
      'Progress update',
      0,
      1,
      'I’ll read the confirmed job brief and your profile before drafting.',
    ),
    step('t1', 'tool', 'Reading job details', 1, 4),
    step('t2', 'tool', 'Reading profile', 4, 6),
    step('t3', 'tool', 'Recalling saved context', 6, 7),
    step(
      'c2',
      'commentary',
      'Progress update',
      8,
      9,
      'The role asks for accessible interfaces and documented components. Your notes cover both, so I’ll quote them directly.',
    ),
    step('t4', 'tool', 'Reading packet rules', 22, 23),
    step('t5', 'tool', 'Checking packet', 23, 27),
    step(
      'c3',
      'commentary',
      'Progress update',
      28,
      29,
      'One gap: the posting asks for design-system ownership, and your notes don’t mention it, so I left it out.',
    ),
  ],
};

export const reply = [
  'Your draft is ready for Reviewer: four claims, each quoted from experience.md.',
  'I didn’t claim design-system ownership because your notes don’t mention it. If you’ve done that work, add it to your profile and I’ll use it.',
];
