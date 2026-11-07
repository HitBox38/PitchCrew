import { expect, test } from 'vitest';
import { terminalSignInActions } from '../terminal-links.ts';

test('extracts bounded native sign-in links and conservative device codes without opening anything', () => {
  expect(
    terminalSignInActions(
      'copilot-cli',
      '\u001b[33mCode: FAKE-1234\u001b[0m\nhttps://github.com/login/device',
    ),
  ).toEqual({
    links: ['https://github.com/login/device'],
    codes: ['FAKE-1234'],
    plain: 'Code: FAKE-1234\nhttps://github.com/login/device',
  });
  for (const url of [
    'https://evil.invalid/login',
    'https://github.com.evil.invalid/',
    'https://user:pass@github.com/login',
    'https://github.com:444/login',
    'http://github.com/login',
    'javascript:alert(1)',
  ])
    expect(terminalSignInActions('copilot-cli', url).links).toEqual([]);
  expect(terminalSignInActions('grok', 'https://github.com/login/device').links).toEqual([]);
  expect(
    terminalSignInActions('grok', 'Device code: 123456\nhttps://accounts.x.ai/device').codes,
  ).toEqual(['123456']);
});
