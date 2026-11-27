import { beforeEach, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AgentTask, ChatRequest, Snapshot, WorkQueueView } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/index.ts';

// Static rendering cannot click, so the buttons hand their handlers to the test by label.
const { clicks, store } = vi.hoisted(() => ({
  clicks: new Map<string, () => void>(),
  store: { action: vi.fn(async () => undefined), working: false },
}));
vi.mock('@pitchcrew/design-system/button', async () => {
  const { createElement: h } = await import('react');
  return {
    Button: ({ children, onClick, ...props }: { children?: ReactNode; onClick?: () => void }) => {
      const label = [children].flat().find((child) => typeof child === 'string');
      if (typeof label === 'string' && onClick) clicks.set(label, onClick);
      return h('button', props, children);
    },
  };
});
vi.mock('@/WorkspaceStore/index.ts', () => ({
  useWorkspaceStore: (select: (state: typeof store) => unknown) => select(store),
}));

const { useQueueRequest } = await import('../hooks/useQueueRequest.ts');
const { QueueRequestRecovery } = await import('../components/QueueRequestRecovery.tsx');
const { QueueFollowUps } = await import('../components/QueueFollowUps.tsx');
const { QueueRunningMenu } = await import('../components/QueueRunningMenu.tsx');

const request = {
  id: 'request',
  threadId: 'job:job',
  content: 'Evaluate fit',
  boardAction: 'fit',
  deliveries: [{ roleId: 'scout', status: 'failed', runId: null, error: 'Runtime stopped.' }],
} as ChatRequest;
const Recovery = (props: { action?: Action; shortcut?: string; armedAt?: number }) =>
  createElement(QueueRequestRecovery, {
    model: useQueueRequest(request, 'job:job', {}, props.action),
    ...props,
  });
const render = (props: Parameters<typeof Recovery>[0] = {}) =>
  renderToStaticMarkup(createElement(Recovery, props));

beforeEach(() => {
  clicks.clear();
  store.action.mockClear();
});

it('keeps the Queue page’s quiet Retry, and makes it a host’s glaze verb with its keys', () => {
  const page = render();
  expect(page).toContain('variant="outline"');
  expect(page).not.toContain('aria-keyshortcuts');
  const desk = render({ shortcut: '.needs-row[data-open]', armedAt: 1 });
  expect(desk).toMatch(/<button[^>]*variant="default"[^>]*aria-keyshortcuts=/);
  expect(desk).toContain('data-slot="kbd"');
});

it('retries and skips through the host’s action when given, else the workspace’s', async () => {
  render();
  clicks.get('Retry')?.();
  expect(store.action).toHaveBeenCalledWith('/chat-requests/request', 'PUT', { action: 'resume' });
  const host = vi.fn(async () => undefined);
  render({ action: host });
  clicks.get('Skip and continue')?.();
  await vi.waitFor(() => expect(host).toHaveBeenCalledTimes(2));
  expect(host.mock.calls).toEqual([
    ['/chat-requests/request', 'PUT', { action: 'remove' }],
    ['/queue/job%3Ajob', 'PUT', { action: 'resume' }],
  ]);
  expect(store.action).toHaveBeenCalledTimes(1);
});

it('recovers a failed follow-up through the host’s action', () => {
  const task = {
    id: 'task',
    roleId: 'writer',
    content: 'Tighten the fictional summary',
    status: 'failed',
    error: 'Runtime stopped.',
  } as AgentTask;
  const host = vi.fn(async () => undefined);
  const data = { roles: [{ id: 'writer', name: 'Writer' }] } as Snapshot;
  renderToStaticMarkup(
    createElement(QueueFollowUps, { tasks: [task], queueId: 'job:job', data, action: host }),
  );
  clicks.get('Retry follow-up')?.();
  expect(host).toHaveBeenCalledWith('/queue/job%3Ajob', 'PUT', {
    action: 'retry-follow-up',
    taskId: 'task',
  });
  expect(store.action).not.toHaveBeenCalled();
});

it('names the running queue’s menu by its title unless the host names it', () => {
  const queue = { id: 'job:job', title: 'Corvid' } as WorkQueueView;
  const menu = (label?: string) =>
    renderToStaticMarkup(createElement(QueueRunningMenu, { queue, model: {} as never, label }));
  expect(menu()).toContain('aria-label="Queue actions for Corvid"');
  expect(menu('Job queue actions for Corvid')).toContain(
    'aria-label="Job queue actions for Corvid"',
  );
});
