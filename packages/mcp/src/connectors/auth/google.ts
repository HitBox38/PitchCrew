import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { z } from 'zod';
import { createGoogleCallback } from './google-callback.ts';
import { boundedText, GoogleToken, scopes, tokenResponse } from './helpers.ts';
import type { ConnectorManagerContext } from './types.ts';

export const connectGoogle = async (
  context: ConnectorManagerContext,
  value: unknown,
): Promise<{ authorizationUrl: string }> => {
  const input = z
    .object({
      clientId: z.string().trim().min(1).max(500).optional(),
      clientSecret: z.string().trim().max(500).optional(),
    })
    .strict()
    .parse(value);
  const clientId = input.clientId ?? process.env.PITCHCREW_GOOGLE_CLIENT_ID;
  const clientSecret = input.clientId
    ? (input.clientSecret ?? '')
    : (input.clientSecret ?? process.env.PITCHCREW_GOOGLE_CLIENT_SECRET ?? '');
  if (!clientId)
    throw new Error(
      'Google sign-in is not configured in this installation. Ask the person who manages Pitchcrew to finish setup, or use Advanced setup to connect your own Google app.',
    );
  if (context.pending || context.googleStarting)
    throw new Error('Google sign-in is already in progress. Disconnect to cancel it.');
  if (context.store.google) throw new Error('Disconnect Google before connecting another account.');
  context.googleStarting = true;
  context.errors.google = '';
  const state = randomBytes(32).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const lifetime = context.lifetimes.google.signal;
  let redirectUri = '';
  const server = createServer(
    createGoogleCallback(context, {
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
    context.googleStarting = false;
  }
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Cannot start Google sign-in callback.');
  redirectUri = `http://127.0.0.1:${address.port}/oauth/google`;
  const timer = setTimeout(() => {
    context.errors.google = 'Google sign-in expired. Connect again.';
    context.cancelPending();
  }, 600000);
  timer.unref();
  context.pending = { server, timer, state, busy: false };
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
};
export const cancelPending = (context: ConnectorManagerContext): void => {
  if (!context.pending) return;
  clearTimeout(context.pending.timer);
  context.pending.server.close();
  context.pending.server.closeIdleConnections();
  context.pending = undefined;
};
export const googleAccessToken = async (
  context: ConnectorManagerContext,
  token: GoogleToken,
  lifetime: AbortSignal,
): Promise<string> => {
  if (token.expiresAt > Date.now() + 60000) return token.accessToken;
  if (context.refreshing?.token === token) return context.refreshing.promise;
  const promise = (async () => {
    const response = await context.fetch(
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
    if (context.store.google !== token) throw new Error('Google connection changed. Retry.');
    token.accessToken = result.access_token;
    token.expiresAt = Date.now() + result.expires_in * 1000;
    if (result.refresh_token) token.refreshToken = result.refresh_token;
    if (result.scope) token.scopes = result.scope.split(' ');
    await context.save();
    return token.accessToken;
  })();
  context.refreshing = { token, promise };
  try {
    return await promise;
  } finally {
    if (context.refreshing?.promise === promise) context.refreshing = undefined;
  }
};
