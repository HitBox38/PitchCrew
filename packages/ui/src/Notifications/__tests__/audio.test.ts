import { afterEach, beforeEach, expect, it, vi } from 'vitest';

let contexts: FakeAudio[];
class FakeAudio {
  state = 'suspended';
  currentTime = 0;
  destination = {};
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  suspend = vi.fn(async () => {
    this.state = 'suspended';
  });
  createOscillator = vi.fn(() => ({
    type: '',
    frequency: { value: 0 },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null,
  }));
  createGain = vi.fn(() => ({
    gain: {
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));
  constructor() {
    contexts.push(this);
  }
}
beforeEach(() => {
  contexts = [];
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubGlobal('AudioContext', FakeAudio);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('unlocks once and suspends silent audio instead of resuming on every input', async () => {
  const { unlockNotificationAudio } = await import('../audio.ts');
  unlockNotificationAudio();
  await vi.advanceTimersByTimeAsync(1000);
  expect(contexts).toHaveLength(1);
  expect(contexts[0].suspend).toHaveBeenCalledOnce();
  unlockNotificationAudio();
  expect(contexts[0].resume).toHaveBeenCalledOnce();
});
it('keeps overlapping alerts audible and suspends after the last alert', async () => {
  const { playNotificationSound } = await import('../audio.ts');
  playNotificationSound('message');
  await vi.advanceTimersByTimeAsync(250);
  playNotificationSound('attention');
  await vi.advanceTimersByTimeAsync(250);
  expect(contexts[0].suspend).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1000);
  expect(contexts[0].suspend).toHaveBeenCalledOnce();
  expect(contexts[0].createOscillator).toHaveBeenCalledTimes(5);
  const oscillator = contexts[0].createOscillator.mock.results[0].value;
  oscillator.onended?.();
  expect(oscillator.disconnect).toHaveBeenCalledOnce();
  expect(contexts[0].createGain.mock.results[0].value.disconnect).toHaveBeenCalledOnce();
});
it('does not suspend a longer alert when a shorter alert overlaps it', async () => {
  const { playNotificationSound } = await import('../audio.ts');
  playNotificationSound('attention');
  await vi.advanceTimersByTimeAsync(10);
  contexts[0].currentTime = 0.01;
  playNotificationSound('message');
  await vi.advanceTimersByTimeAsync(400);
  expect(contexts[0].suspend).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1000);
  expect(contexts[0].suspend).toHaveBeenCalledOnce();
});
