import { beforeEach, expect, it, vi } from 'vitest';
import type { Card } from '@pitchcrew/core';
import type { CardDetailsModel } from '../types.ts';

// A minimal hook runner: state and refs persist across renders by call order, like React.
const hooks = vi.hoisted(() => ({ slots: [] as unknown[], index: 0 }));
vi.mock('react', () => ({
  useState: (initial: unknown) => {
    const slot = hooks.index++;
    if (!(slot in hooks.slots)) hooks.slots[slot] = initial;
    return [
      hooks.slots[slot],
      (value: unknown) => {
        hooks.slots[slot] = typeof value === 'function' ? value(hooks.slots[slot]) : value;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const slot = hooks.index++;
    if (!(slot in hooks.slots)) hooks.slots[slot] = { current: initial };
    return hooks.slots[slot];
  },
}));

const { useExportChoices } = await import('../hooks/useExportChoices.ts');
const { jobNextAction } = await import('../next-action.ts');

const card = {
  id: 'job',
  state: 'agreed',
  owner: null,
  packet: {},
  applicationContext: { revision: 'current' },
  packetReview: { contextRevision: 'current' },
} as unknown as Card;

let settle: { resolve: () => void; reject: (error: Error) => void };
const action = vi.fn(
  () =>
    new Promise<unknown>((resolve, reject) => {
      settle = { resolve: () => resolve(undefined), reject };
    }),
);
const render = () => {
  hooks.index = 0;
  return useExportChoices(card, action);
};
const footer = (patch: Partial<CardDetailsModel> = {}) =>
  jobNextAction({
    card,
    data: { roles: [], runs: [], runtimes: [], profile: [] },
    brief: { loaded: { context: {} }, confirmed: true, draft: { requirements: [] } },
    agents: [],
    exported: false,
    busy: false,
    tab: 'application',
    sections: ['export'],
    exportChoices: render(),
    openApplication: vi.fn(),
    setTab: vi.fn(),
    ...patch,
  } as unknown as CardDetailsModel);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  hooks.slots = [];
  action.mockClear();
});

it('keeps Prepare export as navigation until the export choices are open', () => {
  const openApplication = vi.fn();
  const next = footer({ tab: 'job', sections: [], openApplication });
  expect(next.label).toBe('Prepare export');
  next.perform();
  expect(openApplication).toHaveBeenCalledWith('export');
  expect(footer({ sections: ['brief'] }).label).toBe('Prepare export');
  expect(action).not.toHaveBeenCalled();
});

it('requests the visible Word choice once from the footer instead of the suggested PDF', async () => {
  expect(render().format).toBe('pdf');
  render().setFormat('docx');
  const next = footer();
  expect(next).toMatchObject({ label: 'Request export approval', disabled: false });
  expect(next.hint).toContain('Word (.docx), formatted, plus Markdown copies');
  expect(next.hint).toContain('Nothing is sent');
  next.perform();
  next.perform();
  expect(action).toHaveBeenCalledOnce();
  expect(action).toHaveBeenCalledWith(
    '/cards/job/approval',
    'POST',
    { formats: ['docx'], layout: 'formatted' },
    'Documents generated for review in Decisions',
  );
  expect(footer().disabled).toBe(true);
  expect(render().requesting).toBe(true);
  settle.resolve();
  await flush();
  expect(render().requesting).toBe(false);
});

it('sends both formats with plain layout, or Markdown only, exactly as chosen', async () => {
  render().setFormat('both');
  render().setLayout('plain');
  expect(footer().hint).toContain('PDF and Word, plain text');
  footer().perform();
  expect(action).toHaveBeenLastCalledWith(
    '/cards/job/approval',
    'POST',
    { formats: ['pdf', 'docx'], layout: 'plain' },
    expect.any(String),
  );
  settle.resolve();
  await flush();
  render().setFormat('markdown');
  expect(footer().hint).toMatch(/^Markdown copies only\./);
  footer().perform();
  expect(action).toHaveBeenLastCalledWith(
    '/cards/job/approval',
    'POST',
    { formats: [], layout: 'plain' },
    expect.any(String),
  );
});

it('keeps the chosen files after a failed request and allows another attempt', async () => {
  render().setFormat('docx');
  footer().perform();
  settle.reject(new Error('Export checks failed'));
  await flush();
  const after = render();
  expect(after).toMatchObject({ format: 'docx', layout: 'formatted', requesting: false });
  expect(footer({ busy: true }).disabled).toBe(true);
  footer().perform();
  expect(action).toHaveBeenCalledTimes(2);
});
