import { describe, expect, it } from 'vitest';
import { activeQuestion, optionShortcut, submitsAnswer } from '../helpers.ts';

describe('shared question dock selection', () => {
  const questions = [{ id: 'first' }, { id: 'second' }];
  it('keeps an explicit collapse closed even when pending questions remain', () => {
    expect(activeQuestion(questions, '')).toBe('');
  });
  it('selects the first pending question initially and after the selected question resolves', () => {
    expect(activeQuestion(questions, undefined)).toBe('first');
    expect(activeQuestion(questions, 'resolved')).toBe('first');
    expect(activeQuestion([], 'resolved')).toBeUndefined();
  });
  it('keeps a chosen pending question active instead of switching to the first', () => {
    expect(activeQuestion(questions, 'second')).toBe('second');
  });
});

const key = (overrides: Partial<Parameters<typeof submitsAnswer>[0]> = {}) => ({
  key: 'Enter',
  shiftKey: false,
  altKey: false,
  isComposing: false,
  ...overrides,
});

describe('question answer keys', () => {
  it('answers on Enter and keeps Shift+Enter for a new line', () => {
    expect(submitsAnswer(key())).toBe(true);
    expect(submitsAnswer(key({ shiftKey: true }))).toBe(false);
    expect(submitsAnswer(key({ altKey: true }))).toBe(false);
  });

  it('leaves IME composition and other keys alone', () => {
    expect(submitsAnswer(key({ isComposing: true }))).toBe(false);
    expect(submitsAnswer(key({ key: 'a' }))).toBe(false);
  });
});

describe('question option shortcuts', () => {
  const press = (key: string, extra: Partial<KeyboardEvent> = {}) => ({
    key,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    ...extra,
  });

  it('maps 1–9 to existing options only', () => {
    expect(optionShortcut(press('1'), 2)).toBe(0);
    expect(optionShortcut(press('2'), 2)).toBe(1);
    expect(optionShortcut(press('3'), 2)).toBeNull();
    expect(optionShortcut(press('0'), 2)).toBeNull();
  });

  it('ignores modified presses so app shortcuts keep working', () => {
    expect(optionShortcut(press('1', { metaKey: true }), 2)).toBeNull();
    expect(optionShortcut(press('1', { ctrlKey: true }), 2)).toBeNull();
    expect(optionShortcut(press('1', { altKey: true }), 2)).toBeNull();
  });
});
