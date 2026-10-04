import { expect, it } from 'vitest';
import { isConnectorExternalUrl, isGoogleAuthorizationUrl } from '../src/external-url.ts';

it('opens only Google PKCE authorization URLs with a loopback Pitchcrew callback', () => {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    redirect_uri: 'http://127.0.0.1:14490/oauth/google',
    response_type: 'code',
    state: 'fixture-state',
    code_challenge: 'fixture-challenge',
    code_challenge_method: 'S256',
  }).toString();
  expect(isGoogleAuthorizationUrl(url.toString())).toBe(true);
  for (const value of [
    'javascript:alert(1)',
    'file:///etc/passwd',
    'https://accounts.google.com.evil.example/o/oauth2/v2/auth',
    url.toString().replace('https:', 'http:'),
    url.toString().replace('127.0.0.1', 'evil.example'),
    url.toString().replace('S256', 'plain'),
    url.toString().replace('/o/oauth2/v2/auth', '/other'),
    url.toString().replace('accounts.google.com', 'user@accounts.google.com'),
  ])
    expect(isGoogleAuthorizationUrl(value)).toBe(false);
});

it('opens only the exact GitHub CLI installation page', () => {
  expect(isConnectorExternalUrl('https://cli.github.com/')).toBe(true);
  expect(isConnectorExternalUrl('https://github.com/googleworkspace/cli')).toBe(true);
  for (const url of [
    'http://cli.github.com/',
    'https://cli.github.com.evil.example/',
    'https://user@cli.github.com/',
    'https://cli.github.com/?redirect=evil',
    'https://cli.github.com/manual',
    'https://github.com/googleworkspace/cli?redirect=evil',
    'https://github.com/googleworkspace/cli/issues',
    'https://github.com.evil.example/googleworkspace/cli',
    'https://github.com/login/device',
  ])
    expect(isConnectorExternalUrl(url)).toBe(false);
});
