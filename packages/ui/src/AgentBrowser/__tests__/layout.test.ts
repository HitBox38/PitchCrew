import { describe, expect, it } from 'vitest';
import type { BrowserSessionInfo, RunActivity } from '@pitchcrew/core';
import { browserModeChip, runActivitySummary, shownPanelView } from '../layout.ts';

const session = (patch: Partial<BrowserSessionInfo> = {}): BrowserSessionInfo => ({
  roleId: 'submitter',
  runId: 'run-1',
  taskId: 'task-1',
  threadId: 'thread-1',
  cardId: 'card-1',
  status: 'open',
  mode: 'supervised',
  manual: false,
  allowedSites: [],
  url: 'https://example.test/apply',
  title: 'Apply',
  ...patch,
});

describe('browser panel view', () => {
  const base = { view: 'packet' as const, packet: true, expanded: false };
  it('shows the packet only in the split panel of a job with a packet', () => {
    expect(shownPanelView(base)).toBe('packet');
    expect(shownPanelView({ ...base, packet: false })).toBe('browser');
    expect(shownPanelView({ ...base, expanded: true })).toBe('browser');
    expect(shownPanelView({ ...base, view: 'browser' })).toBe('browser');
  });
});

describe('browser mode chip', () => {
  it('names the captured task permission while an agent turn runs', () => {
    expect(browserModeChip(session(), false)?.label).toBe('Supervised');
    expect(browserModeChip(session({ mode: 'autonomous' }), false)).toMatchObject({
      tone: 'autonomous',
      label: 'Autonomous preparation',
    });
  });
  it('shows Private whenever the user holds or has kept control', () => {
    expect(browserModeChip(session({ mode: 'autonomous' }), true)?.tone).toBe('private');
    expect(browserModeChip(session({ manual: true, runId: null }), false)?.label).toBe('Private');
  });
  it('has no chip without an active turn or takeover', () => {
    expect(browserModeChip(session({ runId: null }), false)).toBeNull();
    expect(browserModeChip(undefined, false)).toBeNull();
  });
});

describe('expanded activity summary', () => {
  const entry = (id: string, kind: RunActivity['kind'], text?: string): RunActivity => ({
    id,
    kind,
    label: id,
    text,
    status: 'completed',
    startedAt: '2026-10-31T10:00:00.000Z',
    finishedAt: '2026-10-31T10:00:01.000Z',
  });
  it('lists tool steps and keeps only the latest non-empty commentary', () => {
    const summary = runActivitySummary([
      entry('a', 'commentary', 'Opening the form'),
      entry('b', 'tool'),
      entry('c', 'commentary', 'Two fields left'),
      entry('d', 'reasoning'),
      entry('e', 'commentary', '  '),
    ]);
    expect(summary.steps.map((step) => step.id)).toEqual(['b', 'd']);
    expect(summary.commentary?.id).toBe('c');
  });
});
