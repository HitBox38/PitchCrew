import { afterEach, expect, it, vi } from 'vitest';
import { watchRuntimeDeadline } from '../src/process/deadline.ts';
afterEach(() => vi.useRealTimers());
it('an already-running child observes parent extensions at the original expiry', async () => {
  vi.useFakeTimers();
  const deadline = { expiresAt: Date.now() + 30 * 60_000 };
  const expired = vi.fn();
  const cancel = watchRuntimeDeadline({ deadline }, expired);
  await vi.advanceTimersByTimeAsync(29 * 60_000);
  deadline.expiresAt += 15 * 60_000;
  await vi.advanceTimersByTimeAsync(60_000);
  expect(expired).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(15 * 60_000);
  expect(expired).toHaveBeenCalledOnce();
  cancel();
});
it('clears pending expiry on cancellation and preserves ordinary 30-minute turns', async () => {
  vi.useFakeTimers();
  const expired = vi.fn();
  const cancel = watchRuntimeDeadline({}, expired);
  await vi.advanceTimersByTimeAsync(30 * 60_000 - 1);
  expect(expired).not.toHaveBeenCalled();
  cancel();
  await vi.advanceTimersByTimeAsync(1);
  expect(expired).not.toHaveBeenCalled();
});
