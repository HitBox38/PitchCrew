import { afterEach, expect, it, vi } from 'vitest';
import {
  clearVisibleQuestionToast,
  getVisibleQuestionToasts,
  setVisibleQuestionToast,
  subscribeQuestionToastVisibility,
} from '../toast-visibility.ts';
import { notificationInView } from '../../Notifications/helpers.ts';

const owners: symbol[] = [];
const owner = () => {
  const value = Symbol('fixture dock');
  owners.push(value);
  return value;
};
afterEach(() => owners.splice(0).forEach(clearVisibleQuestionToast));

it('publishes the exact existing question message ID and clears only the closing dock owner', () => {
  const first = owner(),
    second = owner();
  setVisibleQuestionToast(first, 'question-message');
  setVisibleQuestionToast(second, 'other-message');
  expect(getVisibleQuestionToasts()).toEqual(
    new Set(['message:question-message', 'message:other-message']),
  );
  clearVisibleQuestionToast(first);
  expect(getVisibleQuestionToasts()).toEqual(new Set(['message:other-message']));
  setVisibleQuestionToast(second, undefined);
  expect(getVisibleQuestionToasts().size).toBe(0);
});

it('retains other owners and a stable snapshot when the same dock is republished', () => {
  const first = owner(),
    second = owner(),
    changed = vi.fn();
  const unsubscribe = subscribeQuestionToastVisibility(changed);
  setVisibleQuestionToast(first, 'question-message');
  const snapshot = getVisibleQuestionToasts();
  setVisibleQuestionToast(first, 'question-message');
  setVisibleQuestionToast(second, 'question-message');
  clearVisibleQuestionToast(first);
  expect(getVisibleQuestionToasts()).toBe(snapshot);
  expect(changed).toHaveBeenCalledTimes(1);
  clearVisibleQuestionToast(second);
  expect(changed).toHaveBeenCalledTimes(2);
  unsubscribe();
});

it('suppresses insertion after layout publication even if notification rendering saw an older snapshot', () => {
  const renderedSnapshot = getVisibleQuestionToasts();
  const question = {
    id: 'message:question-message',
    context: 'input' as const,
    target: '/chat/fixture' as const,
  };
  expect(notificationInView(question, '/chat/fixture', true, renderedSnapshot)).toBe(false);
  setVisibleQuestionToast(owner(), 'question-message');
  expect(notificationInView(question, '/chat/fixture', true, getVisibleQuestionToasts())).toBe(
    true,
  );
  expect(renderedSnapshot.size).toBe(0);
});
