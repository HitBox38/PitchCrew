import { expect, test } from 'vitest';
import { createPinch } from '../pinch.ts';

test('adds pinch deltas up to one zoom step in the gesture’s direction', () => {
  const step = createPinch();
  expect(step({ deltaY: -15, timeStamp: 0 })).toBe(0);
  expect(step({ deltaY: -15, timeStamp: 16 })).toBe(0);
  expect(step({ deltaY: -15, timeStamp: 32 })).toBe(1);
  expect(step({ deltaY: 120, timeStamp: 48 })).toBe(-1);
});

test('drops a gesture’s leftover after a pause, so the next pinch starts from nothing', () => {
  const step = createPinch();
  expect(step({ deltaY: -35, timeStamp: 0 })).toBe(0);
  // Without the pause this would cross the step at once.
  expect(step({ deltaY: -10, timeStamp: 1000 })).toBe(0);
  expect(step({ deltaY: -25, timeStamp: 1016 })).toBe(0);
  expect(step({ deltaY: -10, timeStamp: 1032 })).toBe(1);
});

test('never steps against the reader’s direction when a pinch reverses', () => {
  const step = createPinch();
  expect(step({ deltaY: -35, timeStamp: 0 })).toBe(0);
  // Leftover zoom-in delta must not turn this zoom-out movement into a zoom in.
  expect(step({ deltaY: 10, timeStamp: 16 })).toBe(0);
  expect(step({ deltaY: 30, timeStamp: 32 })).toBe(-1);
});
