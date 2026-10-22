import { expect, test } from 'vitest';
import { chatFileCitations, fileCitationUrl, parseFileCitation } from '../src/chat-citations.ts';
import { agentChatReferences } from '../src/chat-references.ts';

test('file identities round trip unicode and spaces without accepting paths or arbitrary schemes', () => {
  const url = fileCitationUrl('profile', 'Résumé notes.md');
  expect(parseFileCitation(url)).toEqual({ kind: 'profile', ids: ['Résumé notes.md'] });
  for (const invalid of [
    'file:///etc/passwd',
    'https://example.com',
    'pitchcrew-file:attachment/one',
    'pitchcrew-file:profile/a/b',
    'pitchcrew-file:profile/%2Fetc',
    'pitchcrew-file:profile/%5Csecret',
    'pitchcrew-file:profile/%00',
    'pitchcrew-file:profile/%ZZ',
  ]) {
    expect(parseFileCitation(invalid)).toBeNull();
  }
  expect(chatFileCitations([], [{ name: 'Résumé notes.md', content: 'private contents' }])).toEqual(
    [{ name: 'Résumé notes.md', url }],
  );
});

test('only real agent mentions become references, without interpreting skill or action requests', () => {
  const content =
    '@writer Check @unknown. Keep `@writer`, person@writer.com and https://example.com/@writer literal. $skill /hiring-panel';
  expect(agentChatReferences(content, [{ id: 'writer', name: 'My Writer' }])).toEqual([
    { kind: 'agent', id: 'writer', label: 'My Writer', token: '@writer', start: 0, end: 7 },
  ]);
});
