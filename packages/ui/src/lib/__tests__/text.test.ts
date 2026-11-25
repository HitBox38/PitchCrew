import { expect, it } from 'vitest';
import { capitalize, ordinal, withoutSubject, wordCut } from '../text.ts';

it('writes ordinals, teens included', () => {
  expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111, 112].map(ordinal)).toEqual([
    '1st',
    '2nd',
    '3rd',
    '4th',
    '11th',
    '12th',
    '13th',
    '21st',
    '22nd',
    '23rd',
    '101st',
    '111th',
    '112th',
  ]);
});

it('cuts a long line at a word, or mid-word when no word ends late enough', () => {
  expect(wordCut('  Draft   the\napplication  ', 60)).toBe('Draft the application');
  expect(wordCut('Compare the two offers line by line and tell me which pays more', 30)).toBe(
    'Compare the two offers line…',
  );
  expect(wordCut('Compare the two offers line by line', 30).length).toBeLessThanOrEqual(30);
  expect(wordCut('Supercalifragilisticexpialidocious and more', 20)).toBe('Supercalifragilisti…');
  expect(wordCut('Short words then averyveryveryverylongword', 24)).toBe('Short words then…');
});

it('capitalizes the first letter only', () => {
  expect(capitalize('next in line')).toBe('Next in line');
  expect(capitalize('Paused by you')).toBe('Paused by you');
  expect(capitalize('')).toBe('');
});

it('drops a leading subject the row already names, and nothing else', () => {
  expect(withoutSubject('Initech: Application work', 'Initech')).toBe('Application work');
  expect(withoutSubject('Initech · Application work', 'Initech')).toBe('Application work');
  expect(withoutSubject('Initech – Application work', 'Initech')).toBe('Application work');
  expect(withoutSubject('Evaluating fit', 'Initech')).toBe('Evaluating fit');
  // Only after a separator and a space: a longer name or the bare subject stays as it is.
  expect(withoutSubject('Initech Labs: Draft', 'Initech')).toBe('Initech Labs: Draft');
  expect(withoutSubject('Initech', 'Initech')).toBe('Initech');
});
