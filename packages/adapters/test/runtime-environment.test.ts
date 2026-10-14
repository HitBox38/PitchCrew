import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { cliEnvironment } from '../src/process/environment.ts';

afterEach(() => vi.unstubAllEnvs());

it('preserves inherited PATH precedence and deduplicates native installation folders', () => {
  const local = join(homedir(), '.local', 'bin');
  const native = join(homedir(), '.grok', 'bin');
  const inherited = [join(homedir(), 'custom-bin'), native, local].join(delimiter);
  vi.stubEnv('PATH', inherited);
  const environment = cliEnvironment({ GROK_HOME: '/fictional/isolated-run' });
  expect(environment.PATH).toBe(inherited);
  expect(process.env.PATH).toBe(inherited);
});

it('adds native installation folders to explicit PATH overrides without exposing connector config', () => {
  vi.stubEnv('PITCHCREW_GOOGLE_CLIENT_SECRET', 'fictional-secret');
  const override = join(homedir(), 'custom-bin');
  const environment = cliEnvironment({ PATH: override });
  expect(environment.PATH).toBe(
    [override, join(homedir(), '.local', 'bin'), join(homedir(), '.grok', 'bin')].join(delimiter),
  );
  expect(environment.PITCHCREW_GOOGLE_CLIENT_SECRET).toBeUndefined();
});
