import { describe, expect, it } from 'vitest';
import { hermesVersion } from '../src/hermes/version.ts';

describe('Hermes version banner', () => {
  it('extracts the agent version without installation paths, dependency versions or update notices', () => {
    const output = [
      'Hermes Agent v0.22.2 (2026.9.24) · stable · local fixture',
      'Install directory: C:\\Users\\fixture\\AppData\\Local\\hermes\\hermes-agent',
      'Install method: git',
      'Python: 3.14.7',
      'OpenAI SDK: 2.24.0',
      "Update available — run 'hermes update'",
    ].join('\r\n');
    expect(output.length).toBeGreaterThan(100);
    expect(hermesVersion(output)).toBe('0.22.2');
  });
  it('finds the labelled version after a long startup notice and strips terminal formatting', () => {
    expect(
      hermesVersion(
        `${'Fixture startup notice. '.repeat(12)}\n\u001b[32mHermes Agent v0.22.3-rc.1\u001b[0m\nPython: 3.14.7`,
      ),
    ).toBe('0.22.3-rc.1');
  });
  it('does not mistake dependency versions for an installed Hermes version', () => {
    expect(hermesVersion('Python: 3.14.7\nOpenAI SDK: 2.24.0')).toBe('');
  });
});
