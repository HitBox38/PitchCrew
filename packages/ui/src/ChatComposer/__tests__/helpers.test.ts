import { expect, it } from 'vitest';
import { chatTokens, chatTrigger, validChatReferences } from '@pitchcrew/core/chat-references';
import { filterSuggestions, trimmedReferences } from '../helpers.ts';

it('detects only standalone symbols outside code, links, paths, prices and addresses', () => {
  for (const text of [
    'name@company.com',
    'https://example.com/@reviewer',
    '$120k',
    '/tmp/build',
    '`@reviewer`',
    '```ts\n@reviewer\n```',
    '[Use $skill](https://example.com)',
    '\\$skill',
  ]) {
    expect(chatTokens(text), text).toEqual([]);
    expect(chatTrigger(text, text.length), text).toBeNull();
  }
  expect(chatTrigger('Ask @rev then continue', 8)).toEqual({
    symbol: '@',
    query: 'rev',
    start: 4,
    end: 8,
  });
  expect(chatTokens('@reviewer Use $check, please.')).toHaveLength(2);
  expect(chatTokens('@reviewer: Check this.')[0]?.query).toBe('reviewer');
  expect(chatTrigger('$', 1)?.symbol).toBe('$');
});
it('ranks exact and prefix matches and preserves shifted selected references after trimming', () => {
  const items = ['reviewer', 'writer', 'review'].map((name) => ({
    key: name,
    label: name,
    description: '',
    reference: { kind: 'agent' as const, id: name, token: `@${name}`, label: name },
  }));
  expect(
    filterSuggestions(items, { symbol: '@', query: 'review', start: 0, end: 7 }).map((i) => i.key),
  ).toEqual(['review', 'reviewer']);
  const ref = { ...items[0].reference!, start: 2, end: 11 };
  expect(trimmedReferences('  @reviewer  ', [ref])[0]).toMatchObject({ start: 0, end: 9 });
  expect(validChatReferences('@reviewer', [{ ...ref, start: 0, end: 9 }])).toHaveLength(1);
  expect(validChatReferences('`@reviewer`', [{ ...ref, start: 1, end: 10 }])).toHaveLength(0);
});
