import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repositoryRoot, resolveDaemonSettings } from '../src/background/settings.ts';

describe('daemon data directory settings', () => {
  it.each(['..private-data', 'notes:private'])('rejects repository child %s', (name) => {
    const directory = join(repositoryRoot, name);
    expect(() => resolveDaemonSettings({ PITCHCREW_HOME: directory })).toThrow(
      'PITCHCREW_HOME must be outside the repository.',
    );
    expect(() => resolveDaemonSettings({}, ['--home', directory])).toThrow(
      'PITCHCREW_HOME must be outside the repository.',
    );
  });

  it('accepts an external sibling through environment or installed-service arguments', () => {
    const directory = resolve(repositoryRoot, '..', 'private-data');
    expect(resolveDaemonSettings({ PITCHCREW_HOME: directory }).directory).toBe(directory);
    expect(resolveDaemonSettings({}, ['--home', directory]).directory).toBe(directory);
  });
});
