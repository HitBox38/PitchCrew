import { expect, test } from 'vitest';
import type { DocumentFinding } from '@pitchcrew/core';
import { wordLayoutCaveat as packetCaveat } from '../../../../packet/src/verification/word-caveat.ts';
import {
  fileNotes,
  isWordLayoutCaveat,
  notesLabel,
  wordLayoutCaveat,
} from '../document-findings.ts';

test('matches the exact Word caveat the packet checker writes', () => {
  expect(wordLayoutCaveat).toBe(packetCaveat);
});

test('keeps a file’s own notes, including other unpaged Word warnings, and drops only the caveat', () => {
  const caveat: DocumentFinding = { severity: 'warn', check: 'layout', message: wordLayoutCaveat };
  const overrun: DocumentFinding = {
    severity: 'warn',
    check: 'layout',
    message: 'The resume runs past its 1-page target.',
  };
  const error: DocumentFinding = {
    severity: 'error',
    check: 'content',
    message: 'Missing expected text.',
    page: 2,
  };
  expect(isWordLayoutCaveat(caveat)).toBe(true);
  expect(fileNotes([caveat, overrun, error])).toEqual([overrun, error]);
  expect(notesLabel([overrun, error])).toBe('2 layout notes · 1 error');
  expect(notesLabel([overrun])).toBe('1 layout note');
});
