import { expect, it } from 'vitest';
import { parseChatResult } from '../src/process/results.ts';

it('turns a malformed chat reply into a plain, retryable error', () => {
  // A real OpenCode turn once surfaced "JSON Parse error: Unterminated string" to the user.
  expect(() => parseChatResult('{"reply":"Emphasize one strength')).toThrow(
    'The reply came back incomplete or malformed, so it wasn’t saved. Retry the message.',
  );
  expect(() => parseChatResult('{"reply":"cut off')).not.toThrow(/JSON Parse|Unterminated/);
  expect(parseChatResult('```json\n{"reply":"Lead with ownership."}\n```')).toMatchObject({
    reply: 'Lead with ownership.',
  });
});
