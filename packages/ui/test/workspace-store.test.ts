import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage, ChatStreamState, Snapshot } from '@pitchcrew/core';
import { api } from '../src/api.ts';
import { subscribeChatStream } from '../src/chat-stream.ts';
import { createWorkspaceStore } from '../src/workspace-store.ts';

vi.mock('../src/api.ts', () => ({ api: vi.fn() }));
vi.mock('../src/chat-stream.ts', () => ({ subscribeChatStream: vi.fn() }));

const snapshot: Snapshot = {
  starterSkillErrors: [],
  cards: [],
  roles: [],
  skills: [],
  skillProposals: [],
  runs: [],
  approvals: [],
  computerApprovals: [],
  events: [],
  profile: [],
  runtimes: [],
  dataDirectory: '/fictional/workspace',
  demoAvailable: true,
  messages: [],
  streamingMessages: [],
  proposals: [],
  tasks: [],
  connectors: [],
};
const message: ChatMessage = {
  id: 'fixture',
  threadId: 'scout',
  from: 'scout',
  to: 'user',
  content: 'A live reply',
  cardId: null,
  runId: 'run-fixture',
  createdAt: '',
};
const stream: ChatStreamState = { messages: [], streamingMessages: [message] };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

let stop: (() => void) | undefined;
const unsubscribe = vi.fn();
beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(api).mockReset().mockResolvedValue(snapshot);
  vi.mocked(subscribeChatStream).mockReset().mockReturnValue(unsubscribe);
  unsubscribe.mockClear();
});
afterEach(() => {
  stop?.();
  stop = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('workspace store', () => {
  it('refreshes browser approval decisions without losing streamed replies', async () => {
    const approval: Snapshot['computerApprovals'][number] = {
      id: 'approval-fixture',
      runId: 'run-fixture',
      roleId: 'scout',
      cardId: null,
      action: { kind: 'navigate', url: 'https://example.com/jobs' },
      reason: 'Inspect a fictional listing',
      page: { url: 'about:blank', title: '', text: '', screenshot: '', digest: 'page-fixture' },
      digest: 'action-fixture',
      status: 'pending',
      error: '',
      createdAt: '',
      decidedAt: null,
    };
    vi.mocked(api).mockResolvedValue({ ...snapshot, computerApprovals: [approval] });
    const store = createWorkspaceStore();
    stop = store.getState().startSync();
    await vi.advanceTimersByTimeAsync(0);
    const [onState] = vi.mocked(subscribeChatStream).mock.calls[0]!;
    onState(stream);
    expect(store.getState().data?.computerApprovals).toEqual([approval]);
    const decided = { ...approval, status: 'approved' as const };
    vi.mocked(api)
      .mockResolvedValueOnce(decided)
      .mockResolvedValueOnce({
        ...snapshot,
        computerApprovals: [decided],
      });
    await store.getState().action('/computer-approvals/approval-fixture/decide', 'POST', {
      approved: true,
    });
    expect(api).toHaveBeenCalledWith('/computer-approvals/approval-fixture/decide', 'POST', {
      approved: true,
    });
    expect(store.getState().data?.computerApprovals).toEqual([decided]);
    expect(store.getState().data?.streamingMessages).toEqual([message]);
  });

  it('preserves early and newer streamed replies across polling and action reloads', async () => {
    const initial = deferred<Snapshot>();
    vi.mocked(api).mockReturnValueOnce(initial.promise);
    const store = createWorkspaceStore();
    stop = store.getState().startSync();
    const [onState] = vi.mocked(subscribeChatStream).mock.calls[0]!;
    onState(stream);
    expect(store.getState().data).toBeNull();
    initial.resolve(snapshot);
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().data?.streamingMessages).toEqual([message]);
    await vi.advanceTimersByTimeAsync(2000);
    expect(store.getState().data?.streamingMessages).toEqual([message]);
    onState({ messages: [message], streamingMessages: [] });
    await store.getState().action('/chat/scout', 'POST', { content: 'Hello' });
    expect(store.getState().data?.messages).toEqual([message]);
    expect(store.getState().data?.streamingMessages).toEqual([]);
  });

  it('falls back to polling on disconnect and restores the stream after reconnect', async () => {
    const store = createWorkspaceStore();
    stop = store.getState().startSync();
    await vi.advanceTimersByTimeAsync(0);
    const [onState, onDisconnect] = vi.mocked(subscribeChatStream).mock.calls[0]!;
    onState(stream);
    onDisconnect();
    const completed = { ...snapshot, messages: [message] };
    vi.mocked(api).mockResolvedValue(completed);
    await vi.advanceTimersByTimeAsync(2000);
    expect(store.getState().data).toEqual(completed);
    onState(stream);
    expect(store.getState().data?.streamingMessages).toEqual([message]);
  });

  it('uses one subscription, ignores late updates after cleanup, and can restart', async () => {
    const request = deferred<Snapshot>();
    vi.mocked(api).mockReturnValueOnce(request.promise);
    const store = createWorkspaceStore();
    const firstStop = store.getState().startSync();
    expect(store.getState().startSync()).toBe(firstStop);
    const [onState] = vi.mocked(subscribeChatStream).mock.calls[0]!;
    const signal = vi.mocked(api).mock.calls[0]![3];
    firstStop();
    onState(stream);
    request.resolve(snapshot);
    await vi.advanceTimersByTimeAsync(4000);
    expect(signal?.aborted).toBe(true);
    expect(store.getState().data).toBeNull();
    expect(api).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    stop = store.getState().startSync();
    firstStop();
    await vi.advanceTimersByTimeAsync(0);
    expect(subscribeChatStream).toHaveBeenCalledTimes(2);
    expect(store.getState().data).toEqual(snapshot);
  });

  it('reports connection errors and clears them after polling recovers', async () => {
    vi.mocked(api).mockRejectedValueOnce(new Error('Offline'));
    const store = createWorkspaceStore();
    stop = store.getState().startSync();
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().error).toBe('Offline');
    await vi.advanceTimersByTimeAsync(2000);
    expect(store.getState().error).toBe('');
    expect(store.getState().data).toEqual(snapshot);
  });

  it('refreshes mutations before showing success and keeps working until all actions finish', async () => {
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    vi.mocked(api).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const store = createWorkspaceStore();
    const firstAction = store.getState().action('/first', 'PUT', { enabled: true }, 'Saved');
    const secondAction = store.getState().action('/second');
    expect(store.getState().working).toBe(true);
    first.resolve({ id: 'first' });
    await expect(firstAction).resolves.toEqual({ id: 'first' });
    expect(api).toHaveBeenCalledWith('/first', 'PUT', { enabled: true });
    expect(store.getState().data).toEqual(snapshot);
    expect(store.getState().toast).toBe('Saved');
    expect(store.getState().working).toBe(true);
    second.resolve({ id: 'second' });
    await secondAction;
    expect(store.getState().working).toBe(false);
  });

  it('surfaces mutation and reload failures without leaving the UI busy', async () => {
    const store = createWorkspaceStore();
    vi.mocked(api).mockRejectedValueOnce(new Error('Denied'));
    await expect(store.getState().action('/save')).rejects.toThrow('Denied');
    expect(store.getState().toast).toBe('Denied');
    expect(store.getState().working).toBe(false);
    vi.mocked(api).mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('Offline'));
    await expect(store.getState().action('/save', 'POST', undefined, 'Saved')).rejects.toThrow(
      'Offline',
    );
    expect(store.getState().toast).toBe('Offline');
    expect(store.getState().error).toBe('Offline');
    expect(store.getState().working).toBe(false);
  });

  it('retains filters and bounded recents when navigation closes panels', () => {
    const storage = { getItem: vi.fn(() => '["old",123]'), setItem: vi.fn() };
    vi.stubGlobal('localStorage', storage);
    const store = createWorkspaceStore();
    expect(store.getState().recentIds).toEqual(['old']);
    for (const id of ['a', 'b', 'c', 'd', 'e', 'a']) store.getState().openCard(id);
    store.getState().setQuery('fictional');
    store.getState().setShowClosed(true);
    store.getState().setAdd(true);
    store.getState().setRoleId('writer');
    store.getState().closePanels();
    expect(store.getState()).toMatchObject({
      selectedId: null,
      roleId: null,
      add: false,
      query: 'fictional',
      showClosed: true,
      recentIds: ['a', 'e', 'd', 'c', 'b'],
    });
    expect(storage.setItem).toHaveBeenLastCalledWith(
      'pitchcrew-recent-jobs',
      '["a","e","d","c","b"]',
    );
  });
});
