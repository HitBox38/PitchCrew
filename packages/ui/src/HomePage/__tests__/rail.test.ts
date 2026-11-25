import { describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Snapshot, WorkQueueView } from '@pitchcrew/core';
import { attentionItems } from '@/lib/attention.ts';
import {
  ago,
  brief,
  browserApproval,
  card,
  delivery,
  now,
  queue,
  request,
  run,
  snapshot,
} from '@/lib/__tests__/attention-fixture.ts';
import { installed } from '@/lib/__tests__/crew-lens-fixture.ts';
import { dayLabel } from '@/ActivityPage/history.ts';
import { sinceLines, sinceSummary, sinceWindow } from '@/lib/since.ts';
import { clockLabel } from '@/lib/time.ts';

// Static rendering has no router or store: links render as anchors and the store is a stub.
vi.mock('@tanstack/react-router', async () => {
  const { createElement: h } = await import('react');
  return {
    Link: ({ to, children, ...props }: { to: string; children?: ReactNode }) =>
      h('a', { href: to, ...props }, children),
  };
});
vi.mock('@/WorkspaceStore/index.ts', () => {
  const state = { action: async () => ({}), openCard: () => {}, data: null };
  const useWorkspaceStore = (select: (value: typeof state) => unknown) => select(state);
  return {
    useWorkspaceStore: Object.assign(useWorkspaceStore, {
      getState: () => state,
      subscribe: () => () => {},
    }),
  };
});

const { HomeRail } = await import('../components/HomeRail/index.tsx');
const { railModel } = await import('../components/HomeRail/helpers.ts');
const { SinceSection } = await import('../components/SinceSection/index.tsx');
const { WorkStrip } = await import('../components/WorkStrip.tsx');

const links = { show: () => {}, openCard: () => {} };
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
const rail = (data: Snapshot) =>
  text(
    renderToStaticMarkup(
      createElement(HomeRail, { rail: railModel(data, attentionItems(data)), now, links }),
    ),
  );
const fit = (id: string, extra: Partial<WorkQueueView> = {}) =>
  queue(`job:${id}`, {
    state: 'ready',
    requests: [
      request(`fit-${id}`, { boardAction: 'fit', deliveries: [delivery('scout', 'queued')] }),
    ],
    ...extra,
  });

describe('the crew rail', () => {
  const reviewer = run('r1', {
    cardId: 'halcyon',
    roleId: 'reviewer',
    purpose: 'application-review',
    startedAt: ago(20),
  });
  const submitter = run('run-submit', {
    cardId: 'initech',
    roleId: 'submitter',
    startedAt: ago(18),
  });
  const seat = run('seat', { cardId: 'acme', roleId: 'reviewer', reviewSeatReservation: true });
  const lines = Array.from({ length: 12 }, (_, index) => fit(`q${index + 1}`));
  // The agents' runtime is installed, so the queued fits can start and take their places.
  const busy = installed(
    snapshot({
      cards: [
        card('halcyon', { company: 'Halcyon', state: 'in_review' }),
        card('initech', { company: 'Initech', state: 'awaiting_approval' }),
        card('acme', { company: 'Acme Robotics', state: 'in_review' }),
        card('quill', {
          company: 'Quill Studio',
          state: 'shortlisted',
          applicationContext: brief(),
        }),
        card('forma', { company: 'Forma', state: 'rejected' }),
        ...lines.map((entry) => card(entry.cardId!, { company: entry.cardId!.toUpperCase() })),
      ],
      runs: [reviewer, submitter, seat],
      computerApprovals: [browserApproval('approval-1')],
      queue: {
        concurrency: 5,
        active: 5,
        background: 1,
        queues: [
          queue('job:halcyon', { state: 'running', runs: [reviewer] }),
          queue('job:initech', { state: 'running', runs: [submitter] }),
          queue('job:acme', { state: 'running', runs: [seat] }),
          queue('job:quill', {
            state: 'ready',
            requests: [
              request('draft-quill', {
                boardAction: 'draft',
                deliveries: [delivery('writer', 'queued')],
              }),
            ],
          }),
          ...lines,
          fit('forma', { state: 'paused', paused: true, pauseKind: 'user' }),
        ],
      },
    }),
  );

  it('says what holds every slot, then the line with its places, folded past its head', () => {
    const html = rail(busy);
    expect(html).toContain('Working now 5 of 5 work slots in use');
    expect(html).toContain('Halcyon Reviewing the packet');
    expect(html).toContain('waiting 4 min');
    expect(html).toContain('Waiting for your OK');
    expect(html).toContain('Reserved for Acme Robotics’s deep review');
    expect(html).toContain('1 background routine running outside these queues');
    expect(html).toContain('1 starting');
    expect(html).toContain('Up next 13');
    expect(html).toContain('Quill Studio Draft application Writer · , Waits on you · brief');
    expect(html).toContain('Q1 Evaluate fit Scout · , Next in line');
    expect(html).toContain('Q2 Evaluate fit Scout · , 2nd in line');
    // The fold opens in place to eight rows and "2 more in Queue" (its panel is closed here).
    expect(html).toContain('10 more waiting Q3, Q4 and 8 more');
    expect(html).toContain('Paused by you · 1');
    expect(html).toContain('6 agents, 2 working');
    expect(html).toContain('Pipeline 16 open');
    expect(html).toContain('Closed 1');
  });

  it('says so when nothing runs or waits', () => {
    const html = rail(snapshot({ cards: [card('a')] }));
    expect(html).toContain('Nothing is running. All 5 slots are free.');
    expect(html).toContain('Nothing is waiting for a slot.');
    expect(html).toContain('Leads 1 not scored 1');
    expect(html).not.toContain('Paused by you');
  });

  it('shows the strip only while something runs', () => {
    const model = railModel(busy, attentionItems(busy));
    const strip = text(renderToStaticMarkup(createElement(WorkStrip, { rail: model, now })));
    expect(strip).toContain('Working now 5 of 5 slots');
    expect(strip).toContain('Initech , Submitter , waiting 4 min');
    const idle = railModel(snapshot(), []);
    expect(renderToStaticMarkup(createElement(WorkStrip, { rail: idle, now }))).toBe('');
  });
});

describe('Since you were last here', () => {
  const render = (data: Snapshot, stored: string | null) => {
    const range = sinceWindow(stored, now);
    const lines = sinceLines(data, range.from, attentionItems(data));
    return text(
      renderToStaticMarkup(
        createElement(SinceSection, {
          lines,
          range,
          summary: sinceSummary(lines),
          now,
          links,
          area: { current: null },
          open: false,
          onOpenChange: () => {},
        }),
      ),
    );
  };

  it('lists what was recorded, by day, each line saying where it leads', () => {
    const data = snapshot({
      cards: [card('acme', { company: 'Acme Robotics', state: 'in_review' })],
      runs: [
        run('done', {
          cardId: 'acme',
          purpose: 'application-draft',
          status: 'completed',
          finishedAt: ago(30),
        }),
      ],
    });
    const html = render(data, ago(120));
    expect(html).toContain('Since you were last here since');
    expect(html).toContain(`${dayLabel(ago(30), new Date(now))} `);
    expect(html).toContain('Writer drafted Acme Robotics , Job details');
  });

  it('shows no clock beside work interrupted when Pitchcrew stopped, only the restart that found it', () => {
    const data = snapshot({
      cards: [card('lumen', { company: 'Lumen Labs' })],
      runs: [
        run('fit', {
          cardId: 'lumen',
          roleId: 'scout',
          purpose: 'fit',
          status: 'failed',
          message: 'The daemon stopped during this run. Retry the role.',
          startedAt: ago(600),
          finishedAt: ago(5),
        }),
      ],
    });
    const html = render(data, ago(120));
    const found = clockLabel(ago(5));
    expect(html).toContain(
      `Scout’s fit evaluation on Lumen Labs was interrupted when Pitchcrew stopped (found at restart, ${found})`,
    );
    // The time column says nothing; the restart's time appears once, named for what it is.
    expect(html.split(found)).toHaveLength(2);
  });

  it('never says nothing happened: only that nothing was recorded, and why', () => {
    const html = render(snapshot(), null);
    expect(html).toContain('In the last 24 hours');
    expect(html).toContain('Nothing recorded since');
    expect(html).toContain('Pitchcrew records crew work only while it is running.');
    expect(html).not.toMatch(/nothing happened/i);
  });
});
