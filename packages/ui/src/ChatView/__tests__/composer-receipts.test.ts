import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { findComposerReceipt, reconcileComposerReceipts } from '../composer-receipts.ts';
import { refreshComposerReceipt } from '../composer-recovery.ts';
import {
  changeComposer,
  composerState,
  updateComposer,
  useComposerStore,
} from '../composer-state.ts';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const response = (submission: string | null, threadId = 'receipt-thread') =>
  Response.json({ request: submission ? { threadId, submission: { id: submission } } : null });
const keep = (n: number) => ({
  id: `kept-${n}`,
  label: 'Send not confirmed',
  payload: {
    text: `Message ${n}`,
    references: [],
    files: [],
    submission: { id: id(n), intent: 'queue' as const },
  },
});
beforeEach(() => useComposerStore.setState({ threads: {} }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it('reads the exact receipt route and accepts only matching thread and submission identities', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(response(id(1)))
    .mockResolvedValueOnce(response(id(2)))
    .mockResolvedValueOnce(response(id(1), 'other'))
    .mockResolvedValueOnce(response(null))
    .mockResolvedValueOnce(Response.json({}, { status: 503 }));
  vi.stubGlobal('fetch', fetch);
  expect(await findComposerReceipt('receipt-thread', id(1))).toBe(true);
  for (let i = 0; i < 4; i++)
    expect(await findComposerReceipt('receipt-thread', id(1))).toBe(false);
  expect(fetch.mock.calls[0]).toMatchObject([
    `/api/conversations/receipt-thread/messages/receipts/${id(1)}`,
    { method: 'GET', signal: expect.any(AbortSignal) },
  ]);
  expect(await findComposerReceipt('receipt-thread', '../invalid')).toBe(false);
  expect(fetch).toHaveBeenCalledTimes(5);
});

it('bounds a hanging receipt read to five seconds and retains uncertainty', async () => {
  vi.useFakeTimers();
  vi.spyOn(AbortSignal, 'timeout').mockImplementation((milliseconds) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), milliseconds);
    return controller.signal;
  });
  const fetch = vi.fn(
    (_url: string, options: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        options.signal!.addEventListener(
          'abort',
          () => reject(new DOMException('Timeout', 'AbortError')),
          { once: true },
        );
      }),
  );
  vi.stubGlobal('fetch', fetch);
  const read = findComposerReceipt('receipt-thread', id(1));
  await vi.advanceTimersByTimeAsync(5000);
  expect(await read).toBe(false);
  expect(AbortSignal.timeout).toHaveBeenCalledWith(5000);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('refresh removes only accepted checked snapshots, preserving current drafts and newer receipt owners', async () => {
  changeComposer('receipt-thread', 'current draft', []);
  updateComposer('receipt-thread', (state) => ({
    ...state,
    kept: [
      { ...keep(1), label: 'Kept draft' },
      { ...keep(2), label: 'Kept draft', payload: { ...keep(2).payload, submission: undefined } },
    ],
  }));
  let resolve!: (value: Response) => void;
  const fetch = vi.fn(
    () =>
      new Promise<Response>((done) => {
        resolve = done;
      }),
  );
  vi.stubGlobal('fetch', fetch);
  const reload = vi.fn(async () => {});
  const refreshing = refreshComposerReceipt('receipt-thread', undefined, reload);
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  const newerReceipt = Symbol('newer');
  changeComposer('receipt-thread', 'new typing while checking', []);
  updateComposer('receipt-thread', (state) => ({
    ...state,
    kept: [...state.kept, keep(3)],
    receipt: newerReceipt,
    refreshNeeded: true,
    notice: 'New receipt owns this notice',
  }));
  resolve(response(id(1)));
  await refreshing;
  expect(composerState('receipt-thread')).toMatchObject({
    draft: { text: 'new typing while checking' },
    kept: [{ id: 'kept-2' }, { id: 'kept-3' }],
    receipt: newerReceipt,
    refreshNeeded: true,
    notice: 'New receipt owns this notice',
  });
  expect(reload).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('caps each refresh at twenty with two parallel reads and rotates past unresolved drafts', async () => {
  vi.useFakeTimers();
  changeComposer('receipt-thread', 'untouched', []);
  updateComposer('receipt-thread', (state) => ({
    ...state,
    kept: Array.from({ length: 25 }, (_, n) => keep(n + 1)),
  }));
  let active = 0,
    maximum = 0;
  const fetch = vi.fn(async (url: string) => {
    active++;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active--;
    const submission = url.split('/').at(-1)!;
    return response(Number(submission.slice(-12)) > 20 ? submission : null);
  });
  vi.stubGlobal('fetch', fetch);
  const first = reconcileComposerReceipts('receipt-thread');
  await vi.advanceTimersByTimeAsync(100);
  await first;
  expect(fetch).toHaveBeenCalledTimes(20);
  expect(composerState('receipt-thread').kept).toHaveLength(25);
  const next = reconcileComposerReceipts('receipt-thread');
  await vi.advanceTimersByTimeAsync(100);
  await next;
  expect(fetch).toHaveBeenCalledTimes(40);
  expect(maximum).toBe(2);
  expect(composerState('receipt-thread').kept).toHaveLength(20);
  expect(composerState('receipt-thread').draft.text).toBe('untouched');
});
