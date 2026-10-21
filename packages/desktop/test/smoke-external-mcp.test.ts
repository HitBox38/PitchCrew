import type { BrowserWindow } from 'electron';
import { expect, test, vi } from 'vitest';
import { clickSmokeMcpCopy } from '../src/smoke-external-mcp.ts';

const fixture = (attached = false) => {
  const debuggerSession = {
    isAttached: () => attached,
    attach: vi.fn(),
    detach: vi.fn(),
    sendCommand: vi.fn(async () => {}),
  };
  const window = {
    show: vi.fn(),
    focus: vi.fn(),
    webContents: { debugger: debuggerSession, executeJavaScript: vi.fn(async () => {}) },
  };
  return {
    window,
    debuggerSession,
    run: () => clickSmokeMcpCopy(window as unknown as BrowserWindow),
  };
};

test.each([false, true])(
  'emulates only document focus and restores the debugger (attached=%s)',
  async (attached) => {
    const { window, debuggerSession, run } = fixture(attached);
    await run();
    expect(debuggerSession.sendCommand.mock.calls).toEqual([
      ['Emulation.setFocusEmulationEnabled', { enabled: true }],
      ['Emulation.setFocusEmulationEnabled', { enabled: false }],
    ]);
    expect(debuggerSession.attach).toHaveBeenCalledTimes(attached ? 0 : 1);
    expect(debuggerSession.detach).toHaveBeenCalledTimes(attached ? 0 : 1);
    expect(window.webContents.executeJavaScript).toHaveBeenCalledWith(
      expect.stringContaining('copy.click()'),
      true,
    );
    expect(window.show).not.toHaveBeenCalled();
    expect(window.focus).not.toHaveBeenCalled();
  },
);

test('releases focus emulation and the debugger when copying fails', async () => {
  const { window, debuggerSession, run } = fixture();
  window.webContents.executeJavaScript.mockRejectedValue(new Error('Fixture copy failure'));
  await expect(run()).rejects.toThrow('Fixture copy failure');
  expect(debuggerSession.sendCommand).toHaveBeenLastCalledWith(
    'Emulation.setFocusEmulationEnabled',
    { enabled: false },
  );
  expect(debuggerSession.detach).toHaveBeenCalledOnce();
});
