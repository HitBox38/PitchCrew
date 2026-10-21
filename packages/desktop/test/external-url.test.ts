import { expect, it } from 'vitest';
import { externalUrlBlockReason, isAllowedExternalUrl } from '../src/external-url.ts';

const externalLinks = [
  ['job posting', 'https://boards.greenhouse.io/example/jobs/123'],
  ['job source preview', 'https://jobs.ashbyhq.com/example/123'],
  ['chat, Profile and Skill Markdown', 'https://example.com/source?q=role#requirements'],
  ['GitHub source', 'https://github.com/example/repo/blob/main/README.md'],
  ['Google document', 'https://docs.google.com/document/d/fixture/edit'],
  ['HTTP website', 'http://example.com/careers'],
  ['GitHub CLI setup', 'https://cli.github.com/'],
  ['Google CLI setup', 'https://github.com/googleworkspace/cli'],
  [
    'Pitchcrew release',
    `https://github.com/HitBox38/PitchCrew/releases/tag/build-${'a'.repeat(40)}`,
  ],
  [
    'Google sign-in',
    'https://accounts.google.com/o/oauth2/v2/auth?' +
      new URLSearchParams({
        redirect_uri: 'http://127.0.0.1:14490/oauth/google',
        response_type: 'code',
        state: 'fixture-state',
        code_challenge: 'fixture-challenge',
        code_challenge_method: 'S256',
      }),
  ],
] as const;

it.each(externalLinks)('permits the %s link in the system browser', (_label, url) => {
  expect(isAllowedExternalUrl(url)).toBe(true);
});

it('resolves relative renderer links without allowing relative native shell targets', () => {
  expect(externalUrlBlockReason('/chat/scout', 'http://127.0.0.1:4417/')).toBeNull();
  expect(externalUrlBlockReason('#main', 'http://127.0.0.1:4417/')).toBeNull();
  expect(externalUrlBlockReason('/chat/scout')).toBe('invalid-url');
  expect(externalUrlBlockReason('file:///etc/passwd', 'http://127.0.0.1:4417/')).toBe(
    'unsupported-protocol',
  );
});

it.each([
  '',
  'not a URL',
  '/chat/scout',
  '//example.com',
  'https://',
  'https://user:password@example.com/',
  'http://user@example.com/',
  'javascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'file:///etc/passwd',
  'blob:https://example.com/fixture',
  'mailto:fixture@example.com',
  'ftp://example.com/file',
  'ms-settings:privacy',
])('rejects unsafe or invalid external URLs: %s', (url) => {
  expect(isAllowedExternalUrl(url)).toBe(false);
});
