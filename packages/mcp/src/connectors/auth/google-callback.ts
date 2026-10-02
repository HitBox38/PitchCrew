import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import { boundedText, scopes, tokenResponse } from './helpers.ts';
import type { ConnectorManagerContext, GoogleSignIn } from './types.ts';

export function createGoogleCallback(
  this: ConnectorManagerContext,
  { clientId, clientSecret, state, verifier, lifetime, redirectUri }: GoogleSignIn,
) {
  return (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    const callback = new URL(req.url ?? '/', redirectUri());
    if (
      req.method !== 'GET' ||
      req.headers.host !== new URL(redirectUri()).host ||
      callback.pathname !== '/oauth/google' ||
      callback.searchParams.get('state') !== state ||
      this.pending?.state !== state ||
      this.pending.busy
    ) {
      res.writeHead(400).end('Invalid or expired sign-in callback.');
      return;
    }
    this.pending.busy = true;
    void (async () => {
      try {
        const code = callback.searchParams.get('code');
        if (!code || callback.searchParams.has('error'))
          throw new Error('Google sign-in was declined. Try connecting again.');
        const response = await this.fetch(
          'https://oauth2.googleapis.com/token',
          {
            method: 'POST',
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              code,
              code_verifier: verifier,
              redirect_uri: redirectUri(),
              grant_type: 'authorization_code',
            }),
          },
          lifetime,
        );
        const result = tokenResponse.parse(JSON.parse(await boundedText(response)));
        if (!result.refresh_token)
          throw new Error(
            'Google did not grant offline access. Remove the previous Pitchcrew grant in your Google account and reconnect.',
          );
        const granted = result.scope?.split(' ') ?? [];
        if (!scopes.some((scope) => granted.includes(scope)))
          throw new Error(
            'No supported Google read permissions were granted. Reconnect and grant the services you need.',
          );
        const profile = await this.fetch(
          'https://www.googleapis.com/oauth2/v2/userinfo',
          { headers: { authorization: `Bearer ${result.access_token}` } },
          lifetime,
        );
        const account = z
          .object({ email: z.string() })
          .parse(JSON.parse(await boundedText(profile))).email;
        lifetime.throwIfAborted();
        if (this.pending?.state !== state) throw new Error('Sign-in was cancelled.');
        this.store.google = {
          account,
          accessToken: result.access_token,
          refreshToken: result.refresh_token,
          expiresAt: Date.now() + result.expires_in * 1000,
          scopes: granted,
          clientId,
          clientSecret,
        };
        await this.save();
        res
          .writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
          .end(
            'Google Workspace connected to Pitchcrew. You can close this window. Enable the services for each role in Your crew.',
          );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Google connection failed.';
        this.errors.google = message;
        res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' }).end(message);
      } finally {
        if (this.pending?.state === state) this.cancelPending();
      }
    })();
  };
}
