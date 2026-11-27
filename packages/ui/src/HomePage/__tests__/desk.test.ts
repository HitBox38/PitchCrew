import { describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Snapshot } from '@pitchcrew/core';
import { attentionItems, type AttentionKind } from '@/lib/attention.ts';
import {
  browserApproval,
  card,
  everyKind as fixtureKinds,
  everyKindRemote,
  now,
  snapshot,
} from '@/lib/__tests__/attention-fixture.ts';
import { busySnapshot } from '@/lib/__tests__/busy-fixture.ts';
import type { DeskRecord } from '../types.ts';

// Static rendering has no router or store, so links render as anchors and the stores are stubs.
vi.mock('@tanstack/react-router', async () => {
  const { createElement: h } = await import('react');
  return {
    Link: ({ to, children, ...props }: { to: string; children?: ReactNode }) =>
      h('a', { href: to, ...props }, children),
    useNavigate: () => () => {},
  };
});
vi.mock('@/WorkspaceStore/index.ts', () => {
  const state = { setAdd: () => {}, action: async () => ({}), working: false, data: null };
  const useWorkspaceStore = (select: (value: typeof state) => unknown) => select(state);
  return {
    useWorkspaceStore: Object.assign(useWorkspaceStore, {
      getState: () => state,
      subscribe: () => () => {},
    }),
  };
});

const { NeedsYou } = await import('../components/NeedsYou.tsx');
const { NeedsBody } = await import('../components/NeedsBody/index.tsx');
const { bodies } = await import('../components/NeedsBody/bodies.ts');
const { DeskToolsContext } = await import('../hooks/useDeskTools.ts');
const { deskEntries, deskSections, nextOpenKey, openRow, tierGroups } =
  await import('../helpers.ts');
type Desk = import('../hooks/useDesk.ts').Desk;

/** Every kind, with a screenshot on the browser request. */
const everyKind = (): Snapshot => {
  const data = fixtureKinds();
  return {
    ...data,
    computerApprovals: [
      browserApproval('approval-1', {
        page: { ...data.computerApprovals[0]!.page, screenshot: '/9j/4AAQ' },
      }),
    ],
  };
};

const tools = {
  act: () => async () => ({}),
  openCard: () => {},
  lost: () => {},
  resolved: () => {},
};
const deskOf = (data: Snapshot, records: Record<string, DeskRecord> = {}) => {
  const entries = deskEntries(attentionItems(data), records, {});
  const closed = {
    openKey: null,
    armedAt: 0,
    visited: new Set<string>(),
    unfolded: new Set<never>(),
  };
  const desk = openRow(closed, nextOpenKey(entries), entries, 0);
  const sections = deskSections(tierGroups(entries));
  return { entries, sections, desk, fresh: 0, keys: () => {}, said: '', tools };
};
const render = (data: Snapshot, records?: Record<string, DeskRecord>) =>
  renderToStaticMarkup(
    createElement(NeedsYou, {
      desk: deskOf(data, records) as unknown as Desk,
      tray: { current: null },
      items: attentionItems(data),
      data,
      now,
    }),
  );

describe('The desk', () => {
  it('lists every ask under tier captions with the top one open, long tiers folded', () => {
    const html = render(busySnapshot());
    expect(html).toContain('<h2 id="needs-title" class="needs-heading">Needs you</h2>');
    expect(html).toContain('<span class="needs-count" aria-hidden="true">20</span>');
    const captions = [...html.matchAll(/class="needs-tier-caption"><span>([^<]+)<\/span>/g)];
    expect(captions.map((match) => match[1])).toEqual([
      'Ends soon or stops the crew',
      'Queued work waits on you',
      'A record to confirm',
      'Changes nothing until you adopt it',
    ]);
    const rows = [...html.matchAll(/data-kind="([a-z-]+)" data-tone="(ochre|rose)"/g)];
    expect(rows).toHaveLength(20);
    expect(rows.filter((row) => row[2] === 'rose').map((row) => row[1])).toEqual([
      'failure',
      'failure',
    ]);
    // Exactly one row is open, the browser request, and only it has a body.
    const rowTags = html.match(/<div[^>]*class="[^"]*\bneeds-row\b[^"]*"[^>]*>/g) ?? [];
    expect(rowTags).toHaveLength(20);
    expect(rowTags.filter((tag) => tag.includes(' data-open=""'))).toHaveLength(1);
    expect(html.match(/class="needs-open-body"/g)).toHaveLength(1);
    expect(html).toContain('class="needs-open-body" data-kind="browser"');
    expect(html).toContain('5 more · questions and job brief · oldest 1 d');
  });

  it('opens a browser request with its page, its end and no shortcut on a final submission', () => {
    const html = render(everyKind());
    const body = html.slice(html.indexOf('class="needs-open-body"'));
    expect(body).toContain('Waiting on this');
    expect(body).toMatch(/The request ends with the run, <time[^>]*>about \d/);
    expect(body).toContain('aria-label="Enlarge the captured page"');
    expect(body).toContain('Approve submission');
    expect(body).not.toContain('aria-keyshortcuts');
    expect(body).toContain('This approves one exact interaction on the reviewed page.');
    expect(body).toContain('>Details<');
  });

  it('closes plainly when nothing waits, and says nothing else does after decisions', () => {
    const empty = render(snapshot({ onboarding: { version: 1, status: 'dismissed', step: 0 } }));
    expect(empty).toContain('<strong>Nothing needs you right now.</strong> The crew is idle.');
    expect(empty).toContain('Add your first job');
    expect(empty).toContain('href="/pipeline"');
    expect(empty).not.toContain('needs-count');
    const setup = render(snapshot({ onboarding: { version: 1, status: 'setup', step: 0 } }));
    expect(setup).not.toContain('Add your first job');
    const item = attentionItems(everyKind()).find((entry) => entry.kind === 'tracking')!;
    const record: DeskRecord = {
      ...item,
      subject: 'Bluefin',
      label: 'Tracking review',
      text: 'Recorded Screening',
      bead: 'moss',
      decidedAt: new Date(now).toISOString(),
      seq: 1,
      calls: [],
      view: { item, data: everyKind() },
    };
    const bluefin = card('bluefin', { company: 'Bluefin', state: 'submitted' });
    const decided = render(snapshot({ cards: [bluefin] }), { [item.key]: record });
    expect(decided).toContain('Nothing else needs you. The crew carries on.');
    expect(decided).toContain('class="needs-tier-caption"><span>Decided</span>');
    expect(decided).toContain('Recorded Screening');
    expect(decided).toContain('data-tone="moss"');
  });
});

/** Each kind's first verb: what its open row decides or opens with. */
const firstVerbs: Record<AttentionKind, string> = {
  browser: 'Approve submission',
  connection: 'Review in Settings',
  'profile-recovery': 'Review on Profile',
  question: 'Answer and continue',
  failure: 'Retry',
  verify: 'Verify in job details',
  blocked: 'Open the conversation',
  packet: 'Approve packet',
  brief: 'Review and confirm',
  export: 'Choose formats in job details',
  tracking: 'Apply update',
  'role-proposal': 'Review change',
  'skill-proposal': 'Review skill',
  'instruction-update': 'Compare',
  'skill-update': 'Review update',
  'writing-suggestion': 'Apply suggestion',
  'profile-proposal': 'Review on Profile',
};

describe('Open rows', () => {
  it('has a body for every kind, each with its first verb', () => {
    expect(Object.keys(bodies).toSorted()).toEqual(Object.keys(firstVerbs).toSorted());
    const data = everyKind();
    const items = attentionItems(data, { remoteRequests: everyKindRemote });
    expect(items).toHaveLength(17);
    for (const item of items) {
      const html = renderToStaticMarkup(
        createElement(
          DeskToolsContext,
          { value: tools },
          createElement(NeedsBody, { item, data, open: true, armedAt: 0, focusWithin: false }),
        ),
      );
      expect(html, item.kind).toContain(firstVerbs[item.kind]);
    }
  });
});
