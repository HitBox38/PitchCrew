import { describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Snapshot } from '@pitchcrew/core';
import { now, roles } from '@/lib/__tests__/attention-fixture.ts';
import { cast } from '@/lib/__tests__/crew-lens-fixture.ts';

// Static rendering has no router or store: links render as anchors carrying their path and search,
// and the stores are stubs reading the snapshot under test.
const store = vi.hoisted(() => ({ data: null as Snapshot | null }));
vi.mock('@tanstack/react-router', async () => {
  const { createElement: h } = await import('react');
  type LinkProps = {
    to: string;
    params?: Record<string, string>;
    search?: Record<string, string | undefined>;
    children?: ReactNode;
  };
  const href = ({ to, params, search }: LinkProps) => {
    const query = new URLSearchParams(
      Object.entries(search ?? {}).flatMap(([key, value]) => (value ? [[key, value]] : [])),
    ).toString();
    const path = to.replace('$thread', params?.thread ?? '');
    return query ? `${path}?${query}` : path;
  };
  return {
    Link: ({ to, params, search, children, ...props }: LinkProps) =>
      h('a', { href: href({ to, params, search }), ...props }, children),
    useNavigate: () => () => {},
  };
});
vi.mock('@/WorkspaceStore/index.ts', () => {
  const state = {
    action: async () => ({}),
    openCard: () => {},
    working: false,
    get data() {
      return store.data;
    },
  };
  const useWorkspaceStore = (select: (value: typeof state) => unknown) => select(state);
  return {
    useWorkspaceStore: Object.assign(useWorkspaceStore, {
      getState: () => state,
      subscribe: () => () => {},
    }),
  };
});
vi.mock('@/Notifications/store.ts', () => ({
  useNotificationStore: (select: (value: { remoteRequests: never[] }) => unknown) =>
    select({ remoteRequests: [] }),
}));

const { CrewLens } = await import('../index.tsx');
const { CrewStatusTray } = await import('../../CrewStatusTray.tsx');
const { crewStatus } = await import('../../../helpers.ts');

const render = (data: Snapshot) => {
  store.data = data;
  return renderToStaticMarkup(createElement(CrewLens, { data, now }));
};
const attribute = (html: string, name: string) =>
  [...html.matchAll(new RegExp(`${name}="([^"]*)"`, 'g'))].map((match) => match[1]);

describe('At work', () => {
  it('draws busy agents most urgent first, each entry leading to its place', () => {
    const html = render(cast());
    expect(html).toContain('aria-labelledby="crew-lens-heading"');
    expect(html).toContain('>At work</h2>');
    expect(attribute(html, 'data-agent')).toEqual(['submitter', 'scout', 'writer']);
    const hrefs = attribute(html, 'href');
    // A wait opens Home at its item; a run opens the exact run; a queued job opens Queue.
    expect(hrefs).toContain('/?item=browser%3Aapproval-1');
    expect(hrefs).toContain('/?item=question%3Aquestion-1');
    expect(hrefs).toContain('/?item=failure%3Ajob%3Acorvid');
    expect(hrefs).toContain('/chat/t-acme?run=run-acme');
    expect(html).toContain('aria-label="Writer, Acme Robotics, Drafting the packet, running 12m"');
    expect(html).toContain('aria-label="Writer, Globex, crew follow-up for Reviewer, running 5m"');
    expect(html).toContain('aria-label="Submitter, Initech, waiting 4m. Decide in Needs you"');
    expect(html).toContain('Crew follow-up</span>');
  });

  it('names every running job queue’s menu for its job, and approves nothing', () => {
    const html = render(cast());
    expect(
      attribute(html, 'aria-label').filter((label) => /queue actions/i.test(label ?? '')),
    ).toEqual([
      'Job queue actions for Lumen Labs',
      'Job queue actions for Acme Robotics',
      'Job queue actions for Globex',
    ]);
    expect(html).not.toMatch(/Approve|agent queue/i);
  });

  it('groups the slot wait and folds idle agents into one closed tray', () => {
    const html = render(cast());
    expect(html).toContain(
      'aria-label="Scout, Northwind, Kestrel AI, Tidepool, Evaluate fit, queued 1h"',
    );
    expect(html).toContain('All 3 wait for a free work slot, not for Scout');
    expect(html).toContain('<strong>3 idle</strong>');
    const names = /<span class="crew-lens-idle-names">(.*?)<\/span><svg/.exec(html)?.[1];
    expect(names?.replace(/<[^>]+>/g, '')).toBe('Reviewer, Tracker, Pipeline Coach');
    expect(html).toContain('<span class="crew-lens-idle-whole">Pipeline Coach</span>');
    // Wide, each row's summary trigger stays hidden and its entries stay in view.
    expect(html.match(/<button[^>]*\bhidden=""[^>]*class="crew-lens-trigger"/g)).toHaveLength(3);
  });

  it('tones only a stamp’s state word, in a folded row’s summary as on its entries', () => {
    const html = render(cast());
    expect(html).toContain(
      '<span class="crew-lens-fact-word"><span data-tone="ochre">waiting</span> 25m</span>',
    );
    expect(html).toContain(
      '<span class="crew-lens-stamp"><span data-tone="ochre">waiting</span> 25m</span>',
    );
  });

  it('renders nothing for an empty roster', () => {
    expect(render(cast({ roles: [] }))).toBe('');
  });
});

describe('the roster’s status tray', () => {
  const status = (roleId: string) =>
    crewStatus(
      roles.find((role) => role.id === roleId)!,
      cast(),
      now,
    );
  const tray = (roleId: string, name: string) =>
    renderToStaticMarkup(createElement(CrewStatusTray, { status: status(roleId), name }));

  it('leads a browser request to its row in Needs you, never approving it here', () => {
    const html = tray('submitter', 'Submitter');
    expect(html).toContain('data-kind="approving"');
    expect(html).toContain('href="/?item=browser%3Aapproval-1"');
    expect(html).toContain('Waiting for your OK');
  });

  it('puts the question first and names the other work', () => {
    const html = tray('writer', 'Writer');
    expect(html).toContain('data-kind="waiting"');
    // The lens's words for the same question.
    expect(html).toContain('Waiting for your answer');
    expect(html).toContain('Also working on 2 more jobs');
  });
});
