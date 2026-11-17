import { describe, expect, it } from 'vitest';
import type { BrowserSessionInfo, Run, RunActivity } from '@pitchcrew/core';
import {
  browserModeLabels,
  browserModeOrder,
  browserModeSummaries,
} from '@pitchcrew/core/browser-modes';
import {
  automaticTray,
  browserState,
  browserTrayLine,
  runActivitySummary,
  shownBrowserRun,
  shownPanelView,
} from '../layout.ts';

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

describe('browser state chip', () => {
  const state = (patch: Partial<Parameters<typeof browserState>[0]> = {}) =>
    browserState({
      session: session({ runId: null }),
      implicit: false,
      waiting: false,
      opening: false,
      name: 'Scout',
      elsewhere: false,
      ...patch,
    });
  it('names who has the page with one label and bead tone', () => {
    expect(state()).toMatchObject({ tone: 'idle', label: 'Idle' });
    expect(state({ leaseId: 'lease', implicit: true })).toMatchObject({
      tone: 'browsing',
      label: 'You’re browsing',
    });
    expect(state({ leaseId: 'lease' })).toMatchObject({
      tone: 'control',
      label: 'You have control',
    });
    expect(state({ session: session(), leaseId: 'lease' })).toMatchObject({
      tone: 'held',
      label: 'You have control',
    });
    expect(state({ session: session() })).toMatchObject({ tone: 'working', label: 'Working' });
    expect(state({ session: session(), waiting: true })).toMatchObject({ tone: 'waiting' });
    expect(state({ session: session({ manual: true }) })).toMatchObject({ tone: 'paused' });
  });
  it('keeps the permission mode as detail and marks another conversation', () => {
    // Every mode is detail in the shared words, never another tone or label.
    for (const mode of browserModeOrder) {
      for (const waiting of [false, true]) {
        const shown = state({ session: session({ mode }), waiting });
        expect(shown.detail).toContain(`${browserModeLabels[mode]}: ${browserModeSummaries[mode]}`);
        expect(shown.tone).toBe(waiting ? 'waiting' : 'working');
      }
    }
    expect(state({ session: session({ mode: 'full' }) }).detail).toBe(
      `Scout is using this browser. Full access: ${browserModeSummaries.full}`,
    );
    expect(state({ elsewhere: true }).label).toBe('In another chat');
    expect(state({ session: undefined, opening: true })).toMatchObject({ tone: 'opening' });
    expect(state({ session: undefined })).toMatchObject({ tone: 'closed' });
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

describe('tray line', () => {
  it('says who has the page in the chip’s words, with an empty socket when idle', () => {
    const line = (overrides: Partial<Parameters<typeof browserTrayLine>[0]>) =>
      browserTrayLine({
        name: 'Scout',
        held: false,
        implicit: false,
        manual: false,
        working: false,
        ...overrides,
      });
    expect(line({}).tone).toBeNull();
    expect(line({ working: true })).toMatchObject({ tone: 'plum' });
    expect(line({ held: true, implicit: true }).text).toBe(
      'Scout gets the page back when it starts working.',
    );
    expect(line({ held: true, implicit: true, working: true }).text).toBe(
      'Scout waits until you return the page.',
    );
    // While working, the line narrates the latest step instead of a placeholder.
    expect(line({ working: true, step: 'Clicked “Learn more”' }).text).toBe(
      'Scout: Clicked “Learn more”',
    );
    expect(line({ manual: true })).toMatchObject({ tone: 'ochre' });
  });
});

describe('automatic steps tray', () => {
  it('keeps the granted-site wording for Autonomous preparation', () => {
    expect(automaticTray('autonomous')).toEqual({
      region: 'Automatic preparation',
      title: 'Automatic preparation',
      runs: 'On sites you grant, form answers and approved files fill in.',
      asks: 'Buttons, keys, dialogs and submitting still ask here.',
    });
  });
  it('names each access mode by its shared label and says sending still asks', () => {
    for (const mode of ['edits', 'auto', 'full'] as const) {
      const tray = automaticTray(mode);
      expect(tray).toMatchObject({ region: 'Automatic steps', title: browserModeLabels[mode] });
      expect(tray.asks).toMatch(/sending/i);
      // No site grants outside Autonomous preparation, so no grant wording either.
      expect(`${tray.runs} ${tray.asks}`).not.toMatch(/grant/i);
    }
    expect(automaticTray('edits').asks).toBe('Buttons, links, keys, dialogs and sending ask here.');
    expect(automaticTray('auto').asks).toBe('Risky steps and sending ask here.');
    expect(automaticTray('full').asks).toBe('Sending or posting asks here.');
  });
});

describe('shown run', () => {
  it('keeps the latest run in this conversation after the browser run ends', () => {
    const run = (id: string, startedAt: string, threadId = 'chat') =>
      ({ id, roleId: 'scout', threadId, mode: 'chat', startedAt }) as Run;
    const runs = [
      run('a', '2026-11-08T01:00:00Z'),
      run('b', '2026-11-08T02:00:00Z'),
      run('c', '2026-11-08T03:00:00Z', 'other'),
    ];
    expect(shownBrowserRun(runs, 'scout', 'chat', null)?.id).toBe('b');
    expect(shownBrowserRun(runs, 'scout', 'chat', 'a')?.id).toBe('a');
    expect(shownBrowserRun(runs, 'writer', 'chat', null)).toBeUndefined();
  });
});
