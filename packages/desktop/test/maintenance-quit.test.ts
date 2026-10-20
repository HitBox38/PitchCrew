import { expect, it, vi } from 'vitest';
import { waitForMaintenance } from '../src/maintenance-quit.ts';

it('quits immediately without displaying a dialog when no installer is running', async () => {
  const show = vi.fn();
  expect(await waitForMaintenance({ busy: async () => false, show, wait: async () => {} })).toBe(
    true,
  );
  expect(show).not.toHaveBeenCalled();
});
it('waits through verification and closes its progress dialog before allowing quit', async () => {
  const busy = vi
    .fn()
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(true)
    .mockResolvedValue(false);
  let dialogSignal: AbortSignal | undefined;
  expect(
    await waitForMaintenance({
      busy,
      show: (signal) => {
        dialogSignal = signal;
      },
      wait: async () => {},
    }),
  ).toBe(true);
  expect(busy).toHaveBeenCalledTimes(3);
  expect(dialogSignal?.aborted).toBe(true);
});
it('lets the user cancel quitting without cancelling the installer', async () => {
  const busy = vi.fn(async () => true);
  expect(
    await waitForMaintenance({ busy, show: (_signal, cancel) => cancel(), wait: async () => {} }),
  ).toBe(false);
  expect(busy).toHaveBeenCalledTimes(1);
});
