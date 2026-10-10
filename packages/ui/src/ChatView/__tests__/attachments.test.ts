import { expect, it } from 'vitest';
import { chatAttachmentLimits, chatAttachmentMime } from '@pitchcrew/core/chat-attachments';
import { validateAttachments } from '../attachment-helpers.ts';

it('validates the whole selection before adding files, including count, size and portable names', () => {
  expect(
    validateAttachments([
      { name: 'Résumé.PDF', size: 1024 },
      { name: 'notes.md', size: 0 },
    ]),
  ).toBe('');
  expect(
    validateAttachments(Array.from({ length: 6 }, () => ({ name: 'notes.txt', size: 1 }))),
  ).toContain('five');
  expect(
    validateAttachments([
      { name: 'notes.md', size: chatAttachmentLimits.bytes },
      { name: 'more.txt', size: 1 },
    ]),
  ).toContain('10 MB');
  expect(validateAttachments([{ name: 'program.exe', size: 1 }])).toContain('not supported');
  for (const name of [
    '../notes.md',
    'C:\\notes.md',
    'CON.txt',
    'notes\n.txt',
    'file.constructor',
    'file.__proto__',
  ])
    expect(chatAttachmentMime(name)).toBeUndefined();
});
