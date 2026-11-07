import { createInterface } from 'node:readline';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const mode = process.argv[2],
  args = process.argv.slice(3);
if (mode.startsWith('cursor')) {
  if (args.join(' ') !== 'login' || process.env.NO_OPEN_BROWSER !== '1') process.exit(2);
  if (mode === 'cursor-bad')
    process.stdout.write('https://example.invalid/cli/auth?state=fixture\n');
  else {
    process.stdout.write('https://cursor.com/cli/auth?state=');
    setImmediate(() => process.stdout.write('fixture-state\n'));
  }
} else if (mode === 'logout') {
  if (!process.env.GROK_HOME || args.join(' ') !== '--no-auto-update logout') process.exit(3);
  if (
    process.env.GROK_AUTH ||
    process.env.GROK_CONFIG ||
    process.env.GROK_CONFIG_PATH ||
    process.env.GROK_AGENT
  )
    process.exit(4);
  const path = join(process.env.GROK_HOME, 'auth.json');
  if (!existsSync(path)) process.exit(5);
  rmSync(path);
  process.stdout.write('Fictional sign-out completed.\n');
} else {
  const expected =
    mode === 'grok'
      ? '--no-auto-update login --device-auth'
      : mode === 'opencode'
        ? 'auth login'
        : 'login';
  if (args.join(' ') !== expected || !process.stdin.isTTY || !process.stdout.isTTY) process.exit(6);
  if (
    mode === 'grok' &&
    (!process.env.GROK_HOME ||
      process.env.GROK_AUTH ||
      process.env.GROK_CONFIG ||
      process.env.GROK_CONFIG_PATH ||
      process.env.GROK_AGENT)
  )
    process.exit(7);
  process.stdout.write('\u001b[32mFictional auth-only terminal\u001b[0m\r\n');
  if (process.env.OPENAI_API_KEY) process.stdout.write(process.env.OPENAI_API_KEY + '\r\n');
  createInterface({ input: process.stdin }).once('line', (line) => {
    process.stdout.write('Fictional authentication command finished.\r\n');
    process.exit(line === 'fixture-response' ? 0 : 8);
  });
}
