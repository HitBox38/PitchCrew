import { EventEmitter } from 'node:events';
import type { IpcRenderer } from 'electron';
import { expect, it, vi } from 'vitest';
import { createLinkFeedbackBridge, linkFeedbackChannel } from '../src/link-feedback.ts';

it('exposes only known block reasons, without native events or arbitrary payloads', () => {
  const ipc = new EventEmitter();
  const bridge = createLinkFeedbackBridge(ipc as unknown as IpcRenderer);
  expect(Object.keys(bridge)).toEqual(['subscribe']);
  const receive = vi.fn();
  bridge.subscribe(receive);
  const nativeEvent = { sender: { private: 'fixture' } };
  for (const reason of ['invalid-url', 'embedded-credentials', 'unsupported-protocol'])
    ipc.emit(linkFeedbackChannel, nativeEvent, reason);
  expect(receive.mock.calls).toEqual([
    ['invalid-url'],
    ['embedded-credentials'],
    ['unsupported-protocol'],
  ]);
  receive.mockClear();
  for (const payload of [null, undefined, {}, '__proto__', 'https://example.com/private'])
    ipc.emit(linkFeedbackChannel, nativeEvent, payload);
  expect(receive).not.toHaveBeenCalled();
});

it('removes only its own listener when unsubscribed', () => {
  const ipc = new EventEmitter();
  const bridge = createLinkFeedbackBridge(ipc as unknown as IpcRenderer);
  const first = vi.fn();
  const second = vi.fn();
  const unsubscribe = bridge.subscribe(first);
  const stopSecond = bridge.subscribe(second);
  unsubscribe();
  ipc.emit(linkFeedbackChannel, {}, 'invalid-url');
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledExactlyOnceWith('invalid-url');
  stopSecond();
  expect(ipc.listenerCount(linkFeedbackChannel)).toBe(0);
});
