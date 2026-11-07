import { expect, it } from 'vitest';
import { runtimeSignInFailure } from '../auth-errors.ts';
it('gives specific safe recovery for known sign-in failures', () => {
  expect(
    runtimeSignInFailure(new Error('Sign-in expired. Start again to get a new link.')),
  ).toContain('expired');
  expect(runtimeSignInFailure(new Error('Sign-in output exceeded its limit.'))).toContain(
    'too much',
  );
  expect(
    runtimeSignInFailure(
      new Error('The runtime executable is unavailable. Recheck its installation.'),
    ),
  ).toContain('Installation');
});
it.each(['Bearer PRIVATE_UPSTREAM_VALUE', 'constructor', 'toString'])(
  'does not disclose arbitrary native errors: %s',
  (message) => {
    const result = runtimeSignInFailure(new Error(message));
    expect(typeof result).toBe('string');
    expect(result).toBe('Sign-in failed. Retry, or use the CLI instructions and recheck.');
    expect(result).not.toContain('PRIVATE_UPSTREAM_VALUE');
  },
);
