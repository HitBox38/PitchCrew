import { createHash, timingSafeEqual } from 'node:crypto';
import {
  InvalidGrantError,
  InvalidRequestError,
  InvalidScopeError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { oauthScope } from './authorization-state.ts';

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const assertRedirect = (value: string) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new InvalidRequestError('Invalid app callback address.');
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    value.length > 2048 ||
    [...value].some(
      (character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127,
    ) ||
    value.includes('#') ||
    url.username ||
    url.password ||
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))
  )
    throw new InvalidRequestError(
      'App callbacks must use HTTPS or HTTP loopback, without credentials or fragments.',
    );
  return url;
};

export const redirectMatches = (requested: string, registered: string) => {
  const requestedUrl = assertRedirect(requested);
  const registeredUrl = assertRedirect(registered);
  if (requested === registered) return true;
  return (
    ['localhost', '127.0.0.1', '[::1]'].includes(requestedUrl.hostname) &&
    requestedUrl.protocol === registeredUrl.protocol &&
    requestedUrl.hostname === registeredUrl.hostname &&
    requestedUrl.pathname === registeredUrl.pathname &&
    requestedUrl.search === registeredUrl.search
  );
};

export const requestedScopes = (scopes?: string[]): [typeof oauthScope] => {
  const values = scopes?.length ? scopes : [oauthScope];
  if (values.length > 16 || values.some((scope) => scope !== oauthScope))
    throw new InvalidScopeError(
      'Only Pitchcrew access is available. Permissions are chosen in Pitchcrew.',
    );
  return [oauthScope];
};

export const assertVerifier = (verifier: string, challenge: string) => {
  if (!/^[a-zA-Z0-9._~-]{43,128}$/.test(verifier))
    throw new InvalidGrantError('Invalid authorization grant.');
  const actual = createHash('sha256').update(verifier).digest('base64url');
  if (!timingSafeEqual(Buffer.from(actual), Buffer.from(challenge)))
    throw new InvalidGrantError('Invalid authorization grant.');
};
