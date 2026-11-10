import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import type { AuthorizationParams } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import { RemoteAuthorization } from '../src/remote/authorization.ts';
import * as authorizationState from '../src/remote/authorization-state.ts';

const directories: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const directory of directories.splice(0)) {
    expect(directory.startsWith(join(tmpdir(), 'pitchcrew-remote-auth-'))).toBe(true);
    await rm(directory, { recursive: true, force: true });
  }
});
const resource = new URL('https://pitchcrew.example/mcp');
const redirectUri = 'https://bot.example/oauth/callback?from=app';
const verifier = 'a'.repeat(64);
const challenge = createHash('sha256').update(verifier).digest('base64url');
const fixture = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-remote-auth-'));
  directories.push(directory);
  const provider = await RemoteAuthorization.open(directory, resource);
  const client = await provider.clientsStore.registerClient!({
    client_name: 'Grok test app',
    redirect_uris: [redirectUri],
    token_endpoint_auth_method: 'client_secret_post',
    client_secret: 'unused-hosted-secret',
  });
  return { directory, provider, client };
};
const begin = async (
  provider: RemoteAuthorization,
  client: OAuthClientInformationFull,
  params: Partial<AuthorizationParams> = {},
) => {
  let destination = '';
  const response = {
    redirect: (url: string) => {
      destination = url;
    },
  } as Parameters<RemoteAuthorization['authorize']>[2];
  await provider.authorize(
    client,
    { redirectUri, codeChallenge: challenge, state: 'state-value', resource, ...params },
    response,
  );
  const ticket = new URL(destination).pathname.split('/').at(-1)!;
  return {
    ticket,
    request: provider
      .requests()
      .find((request) => request.code === provider.connection(ticket).code)!,
  };
};
const approve = async (
  provider: RemoteAuthorization,
  client: OAuthClientInformationFull,
  write = false,
) => {
  const { ticket, request } = await begin(provider, client);
  await provider.decide(request.id, { approved: true, write });
  const callback = new URL(provider.connection(ticket).redirect!);
  expect(callback.searchParams.get('state')).toBe('state-value');
  expect(callback.searchParams.get('iss')).toBe(new URL('/', resource).href);
  return { ticket, code: callback.searchParams.get('code')! };
};

it('requires local consent, binds codes and permits only one successful concurrent exchange', async () => {
  const { directory, provider, client } = await fixture();
  expect(client.token_endpoint_auth_method).toBe('none');
  expect(client.client_secret).toBeUndefined();
  const pending = await begin(provider, client);
  expect(provider.connection(pending.ticket)).toEqual({
    status: 'waiting',
    code: pending.request.code,
    expiresAt: pending.request.expiresAt,
  });
  expect(provider.connection(pending.request.id)).toEqual({ status: 'expired' });
  expect(provider.clients()).toEqual([]);
  const publicRequest = JSON.stringify(provider.requests());
  expect(publicRequest).not.toContain(pending.ticket);
  expect(publicRequest).not.toContain(challenge);
  await expect(
    provider.exchangeAuthorizationCode(client, pending.ticket, verifier, redirectUri, resource),
  ).rejects.toThrow('Invalid or expired');
  await provider.decide(pending.request.id, { approved: true, write: false });
  const code = new URL(provider.connection(pending.ticket).redirect!).searchParams.get('code')!;
  expect(await provider.challengeForAuthorizationCode(client, code)).toBe(challenge);
  const otherClient = await provider.clientsStore.registerClient!({
    client_name: 'Other',
    redirect_uris: [redirectUri],
  });
  await expect(provider.challengeForAuthorizationCode(otherClient, code)).rejects.toThrow();
  await expect(
    provider.exchangeAuthorizationCode(client, code, 'b'.repeat(64), redirectUri, resource),
  ).rejects.toThrow('Invalid authorization');
  await expect(
    provider.exchangeAuthorizationCode(
      client,
      code,
      verifier,
      'https://other.example/callback',
      resource,
    ),
  ).rejects.toThrow('callback');
  await expect(
    provider.exchangeAuthorizationCode(
      client,
      code,
      verifier,
      redirectUri,
      new URL('https://other.example/mcp'),
    ),
  ).rejects.toThrow('different MCP');
  const results = await Promise.allSettled([
    provider.exchangeAuthorizationCode(client, code, verifier, redirectUri, resource),
    provider.exchangeAuthorizationCode(client, code, verifier, redirectUri, resource),
  ]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  const first = results.find((result) => result.status === 'fulfilled')!;
  if (first.status !== 'fulfilled') throw new Error('Expected one token response.');
  const tokens = first.value;
  expect((await provider.verifyAccessToken(tokens.access_token)).scopes).toEqual([
    'pitchcrew:access',
  ]);
  expect((await provider.verifyAccessToken(tokens.access_token)).extra?.write).toBe(false);
  expect(provider.clients()).toHaveLength(1);
  const saved = await readFile(join(directory, 'remote-mcp.json'), 'utf8');
  for (const secret of [
    tokens.access_token,
    tokens.refresh_token!,
    code,
    pending.ticket,
    'unused-hosted-secret',
  ])
    expect(saved).not.toContain(secret);
  expect(provider.connection(pending.ticket)).toEqual({ status: 'expired' });
  await expect(
    provider.exchangeAuthorizationCode(client, code, verifier, redirectUri, resource),
  ).rejects.toThrow();
  await expect(
    provider.exchangeRefreshToken(client, tokens.refresh_token!, ['pitchcrew:write'], resource),
  ).rejects.toThrow('Only Pitchcrew access');
  const refreshed = await provider.exchangeRefreshToken(
    client,
    tokens.refresh_token!,
    ['pitchcrew:access'],
    resource,
  );
  expect((await provider.verifyAccessToken(refreshed.access_token)).extra?.write).toBe(false);
  expect(provider.clients()[0].write).toBe(false);
});

it('persists grants and rotates refresh tokens without changing locally approved permissions', async () => {
  const { directory, provider, client } = await fixture();
  const { code } = await approve(provider, client, true);
  const tokens = await provider.exchangeAuthorizationCode(
    client,
    code,
    verifier,
    redirectUri,
    resource,
  );
  const reloaded = await RemoteAuthorization.open(directory, resource);
  const grant = reloaded.clients()[0];
  expect(grant.write).toBe(true);
  expect((await reloaded.verifyAccessToken(tokens.access_token)).extra).toEqual({
    grantId: grant.id,
    write: true,
  });
  const wrongAudience = await RemoteAuthorization.open(
    directory,
    new URL('https://other.example/mcp'),
  );
  expect(wrongAudience.clients()).toEqual([]);
  await expect(wrongAudience.verifyAccessToken(tokens.access_token)).rejects.toThrow(
    'expired or revoked',
  );
  const refreshed = await reloaded.exchangeRefreshToken(
    client,
    tokens.refresh_token!,
    ['pitchcrew:access'],
    resource,
  );
  expect(refreshed.refresh_token).not.toBe(tokens.refresh_token);
  expect(refreshed.scope).toBe('pitchcrew:access');
  expect(reloaded.clients()[0].write).toBe(true);
  expect((await reloaded.verifyAccessToken(refreshed.access_token)).extra?.write).toBe(true);
  await expect(reloaded.verifyAccessToken(tokens.access_token)).rejects.toThrow();
  await expect(
    reloaded.exchangeRefreshToken(client, tokens.refresh_token!, undefined, resource),
  ).rejects.toThrow();
  await expect(
    reloaded.exchangeRefreshToken(client, refreshed.refresh_token!, ['pitchcrew:write'], resource),
  ).rejects.toThrow('Only Pitchcrew access');
  await reloaded.revoke(grant.id);
  await reloaded.touch(grant.id);
  const revoked = await RemoteAuthorization.open(directory, resource);
  expect(revoked.clients()).toEqual([]);
  await expect(revoked.verifyAccessToken(refreshed.access_token)).rejects.toThrow();
  await expect(
    revoked.exchangeRefreshToken(client, refreshed.refresh_token!, undefined, resource),
  ).rejects.toThrow();
});

it('expires pending approvals, codes and access tokens and bounds client activity writes', async () => {
  const { directory, provider, client } = await fixture();
  const now = { value: Date.now() };
  vi.spyOn(Date, 'now').mockImplementation(() => now.value);
  const pending = await begin(provider, client);
  now.value += 10 * 60 * 1000 + 1;
  expect(provider.requests()).toEqual([]);
  expect(provider.connection(pending.ticket).status).toBe('expired');
  await expect(
    provider.decide(pending.request.id, { approved: true, write: false }),
  ).rejects.toThrow('expired');
  const expired = await approve(provider, client);
  now.value += 60_001;
  expect(provider.connection(expired.ticket).status).toBe('expired');
  await expect(
    provider.exchangeAuthorizationCode(client, expired.code, verifier, redirectUri, resource),
  ).rejects.toThrow();
  const active = await approve(provider, client);
  const tokens = await provider.exchangeAuthorizationCode(
    client,
    active.code,
    verifier,
    redirectUri,
    resource,
  );
  const id = provider.clients()[0].id;
  expect(provider.clients()[0].lastUsedAt).toBeUndefined();
  await provider.touch(id);
  const saved = await readFile(join(directory, 'remote-mcp.json'), 'utf8');
  now.value += 10_000;
  await provider.touch(id);
  expect(await readFile(join(directory, 'remote-mcp.json'), 'utf8')).toBe(saved);
  now.value += 60 * 60 * 1000;
  await expect(provider.verifyAccessToken(tokens.access_token)).rejects.toThrow();
  const refreshed = await provider.exchangeRefreshToken(
    client,
    tokens.refresh_token!,
    undefined,
    resource,
  );
  expect((await provider.verifyAccessToken(refreshed.access_token)).scopes).toEqual([
    'pitchcrew:access',
  ]);
  expect((await provider.verifyAccessToken(refreshed.access_token)).extra?.write).toBe(false);
  now.value += 30 * 24 * 60 * 60 * 1000;
  await expect(provider.verifyAccessToken(refreshed.access_token)).rejects.toThrow();
  expect(provider.clients()).toEqual([]);
});

it('rejects unsafe redirects and scope escalation and preserves a denied callback', async () => {
  const { provider, client } = await fixture();
  for (const callback of [
    'http://outside.example/callback',
    'https://user:pass@bot.example/cb',
    'https://bot.example/cb#',
    'javascript:alert(1)',
    'https://bot.example/cb\n',
  ])
    await expect(
      provider.clientsStore.registerClient!({ redirect_uris: [callback] }),
    ).rejects.toThrow();
  await expect(begin(provider, client, { scopes: ['settings:write'] })).rejects.toThrow(
    'Only Pitchcrew',
  );
  await expect(begin(provider, client, { codeChallenge: 'not-s256' })).rejects.toThrow('S256');
  await expect(
    begin(provider, client, { redirectUri: 'https://other.example/cb' }),
  ).rejects.toThrow('Unregistered');
  for (const scope of ['pitchcrew:read', 'pitchcrew:write']) {
    await expect(begin(provider, client, { scopes: [scope] })).rejects.toThrow(
      'Only Pitchcrew access',
    );
    await expect(
      provider.clientsStore.registerClient!({ redirect_uris: [redirectUri], scope }),
    ).rejects.toThrow('Only Pitchcrew access');
  }
  const requested = await begin(provider, client, { scopes: ['pitchcrew:access'] });
  expect(requested.request.scopes).toEqual(['pitchcrew:read', 'pitchcrew:write']);
  await provider.decide(requested.request.id, { approved: false, write: false });
  const rejected = provider.connection(requested.ticket);
  expect(rejected.status).toBe('denied');
  expect(new URL(rejected.redirect!).searchParams.get('error')).toBe('access_denied');
  expect(new URL(rejected.redirect!).searchParams.get('state')).toBe('state-value');
  expect(provider.clients()).toEqual([]);
  const native = await provider.clientsStore.registerClient!({
    redirect_uris: ['http://127.0.0.1:4000/callback?native=1'],
  });
  await begin(provider, native, { redirectUri: 'http://127.0.0.1:5000/callback?native=1' });
  await expect(
    begin(provider, native, { redirectUri: 'http://localhost:5000/callback?native=1' }),
  ).rejects.toThrow();
});

it('fails closed on unreadable storage and leaves the original file unchanged', async () => {
  const { directory } = await fixture();
  const path = join(directory, 'remote-mcp.json');
  for (const raw of [
    '{not-json',
    JSON.stringify({ version: 1, clients: [], grants: [], unexpected: true }),
    ' '.repeat(512 * 1024 + 1),
  ]) {
    await writeFile(path, raw);
    await expect(RemoteAuthorization.open(directory, resource)).rejects.toThrow('unreadable');
    expect(await readFile(path, 'utf8')).toBe(raw);
  }
});

it('keeps codes and grants unchanged when durable writes fail and recovers the write queue', async () => {
  const { directory, provider, client } = await fixture();
  const { ticket, code } = await approve(provider, client);
  const save = vi.spyOn(authorizationState, 'writeAuthorizationState');
  save.mockRejectedValueOnce(new Error('private filesystem detail'));
  await expect(
    provider.exchangeAuthorizationCode(client, code, verifier, redirectUri, resource),
  ).rejects.toThrow('Could not save remote app access');
  expect(provider.clients()).toEqual([]);
  expect(provider.connection(ticket).status).toBe('approved');
  const tokens = await provider.exchangeAuthorizationCode(
    client,
    code,
    verifier,
    redirectUri,
    resource,
  );
  const grant = provider.clients()[0];
  save.mockRejectedValueOnce(new Error('private filesystem detail'));
  await expect(provider.revoke(grant.id)).rejects.toThrow('Could not save remote app access');
  expect((await provider.verifyAccessToken(tokens.access_token)).clientId).toBe(client.client_id);
  expect(
    (
      await (
        await RemoteAuthorization.open(directory, resource)
      ).verifyAccessToken(tokens.access_token)
    ).clientId,
  ).toBe(client.client_id);
  const other = await provider.clientsStore.registerClient!({
    redirect_uris: [redirectUri],
    client_name: 'Other',
  });
  await provider.revokeToken(other, { token: tokens.access_token });
  expect((await provider.verifyAccessToken(tokens.access_token)).clientId).toBe(client.client_id);
  await provider.revokeToken(client, { token: tokens.refresh_token! });
  await expect(provider.verifyAccessToken(tokens.access_token)).rejects.toThrow();
  expect(provider.clients()).toEqual([]);
});

it('bounds registrations and pending work, and stopping clears approved in-memory codes', async () => {
  const { directory, provider, client } = await fixture();
  const now = { value: Date.now() };
  vi.spyOn(Date, 'now').mockImplementation(() => now.value);
  for (let index = 0; index < 20; index++) await begin(provider, client);
  await expect(begin(provider, client)).rejects.toThrow('Too many connection requests');
  now.value += 10 * 60 * 1000 + 1;
  const { ticket, code } = await approve(provider, client);
  await provider.revokeAll();
  expect(provider.connection(ticket).status).toBe('expired');
  expect(provider.requests()).toEqual([]);
  await expect(
    provider.exchangeAuthorizationCode(client, code, verifier, redirectUri, resource),
  ).rejects.toThrow();
  const state = {
    version: 1,
    clients: Array.from({ length: 100 }, () => ({
      info: { ...client, client_id: randomUUID() },
      expiresAt: now.value + 60_000,
    })),
    grants: [],
  };
  await writeFile(join(directory, 'remote-mcp.json'), JSON.stringify(state));
  const full = await RemoteAuthorization.open(directory, resource);
  await expect(full.clientsStore.registerClient!({ redirect_uris: [redirectUri] })).rejects.toThrow(
    'Too many app registrations',
  );
  await full.revokeAll();
  expect(
    (await full.clientsStore.registerClient!({ redirect_uris: [redirectUri] })).client_id,
  ).toBeTruthy();
});
