import { EventEmitter } from 'node:events';
import type { WebContents } from 'electron';
import { expect, it, vi } from 'vitest';
import { nativeKeyboardEvents, sendGuestCommand } from '../src/browser/input.ts';
import { guestAutomation } from '../src/browser/automation.ts';

const fixture = () => {
  const sendCommand = vi.fn(async (_method: string, _params?: unknown) => ({
    result: { value: true },
  }));
  const contents = Object.assign(new EventEmitter(), {
    focusedFrame: null,
    mainFrame: {},
    isFocused: vi.fn(() => false),
    isDestroyed: () => false,
    debugger: { sendCommand },
    insertText: vi.fn(async () => {}),
    sendInputEvent: vi.fn(),
    reload: vi.fn(),
    reloadIgnoringCache: vi.fn(),
    executeJavaScriptInIsolatedWorld: vi.fn(async () => {}),
  }) as unknown as WebContents;
  return { contents, sendCommand };
};

it('routes text directly to the unfocused guest instead of the app renderer', async () => {
  const { contents, sendCommand } = fixture();
  await expect(
    sendGuestCommand(contents, 'Input.insertText', { text: 'Native candidate' }),
  ).resolves.toEqual({});
  expect(contents.insertText).toHaveBeenCalledExactlyOnceWith('Native candidate');
  expect(sendCommand).toHaveBeenCalledExactlyOnceWith('Runtime.evaluate', expect.any(Object));
  expect(contents.focusedFrame).toBeNull();
});

it('delivers an unfocused Enter to the guest and waits for native dispatch before replying', async () => {
  const { contents, sendCommand } = fixture();
  await sendGuestCommand(contents, 'Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Enter',
    text: '\r',
    modifiers: 8,
  });
  expect(contents.sendInputEvent).toHaveBeenNthCalledWith(1, {
    type: 'rawKeyDown',
    keyCode: 'Enter',
    modifiers: ['shift'],
  });
  expect(contents.sendInputEvent).toHaveBeenNthCalledWith(2, {
    type: 'char',
    keyCode: '\r',
    modifiers: ['shift'],
  });
  expect(sendCommand).toHaveBeenCalledTimes(2);
  expect(vi.mocked(contents.sendInputEvent).mock.invocationCallOrder[1]).toBeLessThan(
    sendCommand.mock.invocationCallOrder[1]!,
  );
});

it('runs only local editing commands and never reads or changes the clipboard', async () => {
  const { contents, sendCommand } = fixture();
  await sendGuestCommand(contents, 'Input.dispatchKeyEvent', {
    type: 'rawKeyDown',
    key: 'a',
    modifiers: 4,
    commands: ['selectAll', 'paste', 'copy', 'cut', 'undo', 'redo'],
  });
  const expression = (sendCommand.mock.calls[1] as unknown as [string, { expression: string }])[1]
    .expression;
  expect(expression).toContain('["selectAll","undo","redo"]');
  expect(expression).not.toMatch(/paste|copy|cut/);
});

it.each([false, true])('reloads only its own guest (ignore cache %s)', async (ignoreCache) => {
  const { contents, sendCommand } = fixture();
  await sendGuestCommand(contents, 'Page.reload', { ignoreCache });
  expect(
    ignoreCache ? contents.reloadIgnoringCache : contents.reload,
  ).toHaveBeenCalledExactlyOnceWith();
  expect(sendCommand).not.toHaveBeenCalled();
});

it('retains CDP input for a genuinely focused frame and routes OOPIF commands to their own session', async () => {
  const { contents, sendCommand } = fixture();
  Object.defineProperty(contents, 'focusedFrame', { value: contents.mainFrame });
  vi.mocked(contents.isFocused).mockReturnValue(true);
  await sendGuestCommand(contents, 'Input.insertText', { text: 'Focused page' });
  expect(sendCommand).toHaveBeenLastCalledWith('Input.insertText', { text: 'Focused page' });
  const automation = guestAutomation(contents, vi.fn());
  await automation.send('Input.insertText', { text: 'Child frame' }, 'owned-iframe', 'agent');
  expect(sendCommand).toHaveBeenLastCalledWith(
    'Input.insertText',
    { text: 'Child frame' },
    'owned-iframe',
  );
  contents.emit('destroyed');
});

it('uses native editing when emulated focus leaves a stale focused frame on an unfocused guest', async () => {
  const { contents, sendCommand } = fixture();
  Object.defineProperty(contents, 'focusedFrame', { value: contents.mainFrame });
  await sendGuestCommand(contents, 'Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowLeft' });
  expect(contents.sendInputEvent).toHaveBeenCalledExactlyOnceWith({
    type: 'rawKeyDown',
    keyCode: 'Left',
    modifiers: [],
  });
  expect(sendCommand.mock.calls.every(([method]) => method === 'Runtime.evaluate')).toBe(true);
  await sendGuestCommand(contents, 'Input.insertText', { text: 'Native insertion' });
  expect(contents.insertText).toHaveBeenCalledExactlyOnceWith('Native insertion');
});

it('keeps input targeted through CDP when an unfocused guest owns the focused cross-site child frame', async () => {
  const { contents, sendCommand } = fixture();
  Object.defineProperty(contents, 'focusedFrame', { value: {} });
  await sendGuestCommand(contents, 'Input.insertText', { text: 'Owned child field' });
  expect(sendCommand).toHaveBeenLastCalledWith('Input.insertText', { text: 'Owned child field' });
  await sendGuestCommand(contents, 'Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter' });
  expect(sendCommand).toHaveBeenLastCalledWith('Input.dispatchKeyEvent', {
    type: 'rawKeyDown',
    key: 'Enter',
  });
  expect(contents.insertText).not.toHaveBeenCalled();
  expect(contents.sendInputEvent).not.toHaveBeenCalled();
});

it('rejects unfocused cross-site input before native insertion and reports unavailable composition', async () => {
  const { contents, sendCommand } = fixture();
  sendCommand.mockResolvedValueOnce({ result: { value: false } });
  await expect(
    sendGuestCommand(contents, 'Input.insertText', { text: 'Private value' }),
  ).rejects.toThrow('cross-site frame');
  expect(contents.insertText).not.toHaveBeenCalled();
  expect(contents.sendInputEvent).not.toHaveBeenCalled();
  await expect(sendGuestCommand(contents, 'Input.imeSetComposition', {})).rejects.toThrow(
    'Composition input requires',
  );
});

it.each([
  [
    { type: 'keyDown', key: 'ArrowLeft', text: '' },
    [{ type: 'rawKeyDown', keyCode: 'Left', modifiers: [] }],
  ],
  [
    { type: 'keyUp', key: 'ArrowLeft', modifiers: 3 },
    [{ type: 'keyUp', keyCode: 'Left', modifiers: ['alt', 'control'] }],
  ],
  [{ type: 'rawKeyDown', key: 'F24' }, [{ type: 'rawKeyDown', keyCode: 'F24', modifiers: [] }]],
  [
    { type: 'char', text: 'é😀' },
    [
      { type: 'char', keyCode: 'é', modifiers: [] },
      { type: 'char', keyCode: '😀', modifiers: [] },
    ],
  ],
  [
    { type: 'keyDown', key: 'Unidentified', text: 'א' },
    [{ type: 'char', keyCode: 'א', modifiers: [] }],
  ],
  [{ type: 'invalid', key: 'Enter' }, []],
])('translates CDP keys without dropping text or modifier semantics: %j', (params, expected) => {
  expect(nativeKeyboardEvents(params as Record<string, unknown>)).toEqual(expected);
});
