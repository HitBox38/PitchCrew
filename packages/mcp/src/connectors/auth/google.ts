import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { z } from 'zod';
import { createGoogleCallback } from './google-callback.ts';
import { boundedText, GoogleToken, scopes, tokenResponse } from './helpers.ts';
import type { ConnectorManagerContext } from './types.ts';

export async function connectGoogle(
  this: ConnectorManagerContext,
  value: unknown,
): Promise<{ authorizationUrl: string }> {
  const input = z
    .object({
      clientId: z.string().trim().min(1).max(500).optional(),
      clientSecret: z.string().trim().max(500).optional(),
    })
    .strict()
    .parse(value);
  const clientId = input.clientId ?? process.env.PITCHCREW_GOOGLE_CLIENT_ID;
  const clientSecret = input.clientSecret ?? process.env.PITCHCREW_GOOGLE_CLIENT_SECRET ?? '';
  if (!clientId)
    throw new Error(
      'Enter a Google Desktop OAuth client ID, or set PITCHCREW_GOOGLE_CLIENT_ID and restart the daemon.',
    );
  if (this.pending || this.googleStarting)
    throw new Error('Google sign-in is already in progress. Disconnect to cancel it.');
  if (this.store.google) throw new Error('Disconnect Google before connecting another account.');
  this.googleStarting = true;
  this.errors.google = '';
  const state = randomBytes(32).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const lifetime = this.lifetimes.google.signal;
  let redirectUri = '';
  const server = createServer(
    createGoogleCallback.call(this, {
      clientId,
      clientSecret,
      state,
      verifier,
      lifetime,
      redirectUri: () => redirectUri,
    }),
  );
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    lifetime.throwIfAborted();
  } catch {
    server.close();
    throw new Error('Cannot start Google sign-in callback. Try connecting again.');
  } finally {
    this.googleStarting = false;
  }
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Cannot start Google sign-in callback.');
  redirectUri = `http://127.0.0.1:${address.port}/oauth/google`;
  const timer = setTimeout(() => {
    this.errors.google = 'Google sign-in expired. Connect again.';
    this.cancelPending();
  }, 600000);
  timer.unref();
  this.pending = { server, timer, state, busy: false };
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: ['https://www.googleapis.com/auth/userinfo.email', ...scopes].join(' '),
    state,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  }).toString();
  return { authorizationUrl: url.toString() };
}
export function cancelPending(this: ConnectorManagerContext): void {
  if (!this.pending) return;
  clearTimeout(this.pending.timer);
  this.pending.server.close();
  this.pending.server.closeIdleConnections();
  this.pending = undefined;
}
export async function googleAccessToken(
  this: ConnectorManagerContext,
  token: GoogleToken,
  lifetime: AbortSignal,
): Promise<string> {
  if (token.expiresAt > Date.now() + 60000) return token.accessToken;
  if (this.refreshing?.token === token) return this.refreshing.promise;
  const promise = (async () => {
    const response = await this.fetch(
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        body: new URLSearchParams({
          client_id: token.clientId,
          client_secret: token.clientSecret,
          refresh_token: token.refreshToken,
          grant_type: 'refresh_token',
        }),
      },
      lifetime,
    );
    const result = tokenResponse.parse(JSON.parse(await boundedText(response)));
    lifetime.throwIfAborted();
    if (this.store.google !== token) throw new Error('Google connection changed. Retry.');
    token.accessToken = result.access_token;
    token.expiresAt = Date.now() + result.expires_in * 1000;
    if (result.refresh_token) token.refreshToken = result.refresh_token;
    if (result.scope) token.scopes = result.scope.split(' ');
    await this.save();
    return token.accessToken;
  })();
  this.refreshing = { token, promise };
  try {
    return await promise;
  } finally {
    if (this.refreshing?.promise === promise) this.refreshing = undefined;
  }
}
