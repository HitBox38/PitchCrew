/** @license
 * Adapted from T3 Code's apps/desktop/src/preview/GuestInput.ts (MIT).
 * Copyright (c) 2026 T3 Tools Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import type { KeyboardInputEvent, WebContents } from 'electron';

const focusRoutedInput = new Set([
  'Input.insertText',
  'Input.dispatchKeyEvent',
  'Input.imeSetComposition',
]);
const focusedDocument = `(() => {
  let doc = document;
  while (['IFRAME', 'FRAME'].includes(doc.activeElement?.tagName)) {
    if (!doc.activeElement.contentDocument) return null;
    doc = doc.activeElement.contentDocument;
  }
  return doc;
})()`;
const arrows: Record<string, string> = {
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
};
const namedKeys = new Set([
  'Backspace',
  'Tab',
  'Enter',
  'Escape',
  'Delete',
  'Insert',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Shift',
  'Control',
  'Alt',
  'Meta',
  'CapsLock',
  'NumLock',
  'ScrollLock',
  'PrintScreen',
]);
const modifiers = [
  [1, 'alt'],
  [2, 'control'],
  [4, 'meta'],
  [8, 'shift'],
] as const;

export const nativeKeyboardEvents = (params: Record<string, unknown>): KeyboardInputEvent[] => {
  const flags = typeof params.modifiers === 'number' ? params.modifiers : 0;
  const held = modifiers.flatMap(([bit, name]) => (flags & bit ? [name] : []));
  const text = typeof params.text === 'string' ? params.text : '';
  const chars = [...text].map((keyCode) => ({ type: 'char' as const, keyCode, modifiers: held }));
  const key = typeof params.key === 'string' ? params.key : '';
  const keyCode =
    [...key].length === 1
      ? key
      : (arrows[key] ?? (namedKeys.has(key) || /^F(?:[1-9]|1\d|2[0-4])$/.test(key) ? key : null));
  if (params.type === 'char') return chars;
  if (!['keyDown', 'rawKeyDown', 'keyUp'].includes(String(params.type))) return [];
  const type = params.type === 'keyUp' ? 'keyUp' : 'rawKeyDown';
  const events: KeyboardInputEvent[] = keyCode ? [{ type, keyCode, modifiers: held }] : [];
  return params.type === 'keyDown' ? [...events, ...chars] : events;
};

const evaluate = async (contents: WebContents, expression: string) => {
  const result = await contents.debugger.sendCommand('Runtime.evaluate', {
    expression,
    returnByValue: true,
  });
  return result.result?.value;
};

/** CDP keyboard input and reload otherwise follow the embedder's shared window focus. */
export const sendGuestCommand = async (
  contents: WebContents,
  method: string,
  params: Record<string, unknown>,
) => {
  if (method === 'Page.reload') {
    if (params.ignoreCache === true) contents.reloadIgnoringCache();
    else contents.reload();
    return {};
  }
  // Focus emulation and another native window can leave focusedFrame populated
  // while this guest is not the keyboard receiver. CDP then loses native editing
  // defaults such as caret movement even when its keydown event reaches the page.
  if (!focusRoutedInput.has(method)) return contents.debugger.sendCommand(method, params);
  const focused = contents.focusedFrame;
  if (focused && (focused !== contents.mainFrame || contents.isFocused()))
    return contents.debugger.sendCommand(method, params);
  if ((await evaluate(contents, `${focusedDocument} !== null`)) !== true)
    throw new Error(
      'The focused field is in a cross-site frame. Take control and focus its browser page first.',
    );
  if (method === 'Input.insertText') {
    await contents.insertText(typeof params.text === 'string' ? params.text : '');
    return {};
  }
  if (method !== 'Input.dispatchKeyEvent')
    throw new Error('Composition input requires the browser page to have focus.');
  for (const event of nativeKeyboardEvents(params)) contents.sendInputEvent(event);
  const commands = Array.isArray(params.commands)
    ? params.commands.filter((value) => ['selectAll', 'undo', 'redo'].includes(value))
    : [];
  // The ordered evaluate also waits until Chromium has delivered the native keys.
  await evaluate(
    contents,
    `(() => {
    const doc = ${focusedDocument};
    for (const command of ${JSON.stringify(commands)}) doc?.execCommand(command);
    return 0;
  })()`,
  );
  return {};
};
