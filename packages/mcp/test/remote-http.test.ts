import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createHash, randomBytes } from 'node:crypto';
import { createServer, request as httpRequest } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createRemoteHttpHandler, RemoteAuthorization } from '../src/remote/index.ts';

let directory: string;
let authorization: RemoteAuthorization;
let server: ReturnType<typeof createServer>;
let origin: string;
const resource = new URL('https://fixture.trycloudflare.com/mcp');
const clients: Client[] = [];
const call = vi.fn(async () => ({ jobs: 0 }));
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pitchcrew-remote-http-'));
  authorization = await RemoteAuthorization.open(directory, resource);
  server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing fixture address');
  origin = `http://127.0.0.1:${address.port}`;
  server.on(
    'request',
    createRemoteHttpHandler({
      resource,
      localHost: new URL(origin).host,
      authorization,
      instance: 'fixture-instance',
      call,
    }),
  );
  call.mockClear();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(clients.splice(0).map((client) => client.close()));
  server?.closeAllConnections();
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  if (directory) {
    expect(directory.startsWith(join(tmpdir(), 'pitchcrew-remote-http-'))).toBe(true);
    await rm(directory, { recursive: true, force: true });
  }
});

const json = async (path: string, body: unknown) =>
  fetch(origin + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
const begin = async () => {
  const metadata = await (await fetch(origin + '/.well-known/oauth-authorization-server')).json();
  const firstScope = metadata.scopes_supported[0];
  expect(metadata.scopes_supported).toEqual(['pitchcrew:access']);
  const registration = await json('/register', {
    client_name: 'Hosted Grok fixture',
    redirect_uris: ['https://client.example/callback'],
    token_endpoint_auth_method: 'client_secret_post',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    scope: firstScope,
  });
  expect(registration.status).toBe(201);
  const client = await registration.json();
  expect(client.token_endpoint_auth_method).toBe('none');
  expect(client.client_secret).toBeUndefined();
  expect(client.scope).toBe(firstScope);
  const verifier = randomBytes(32).toString('base64url');
  const query = new URLSearchParams({
    client_id: client.client_id,
    response_type: 'code',
    redirect_uri: client.redirect_uris[0],
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    scope: firstScope,
    resource: resource.href,
    state: 'retained-state',
  });
  const response = await fetch(`${origin}/authorize?${query}`, { redirect: 'manual' });
  expect(response.status).toBe(302);
  const waiting = new URL(response.headers.get('location')!);
  expect(waiting.origin).toBe(resource.origin);
  const ticket = waiting.pathname.split('/').at(-1)!;
  expect(authorization.connection(ticket).status).toBe('waiting');
  expect(authorization.clients()).toEqual([]);
  expect(authorization.requests()[0].scopes).toEqual(['pitchcrew:read', 'pitchcrew:write']);
  return { client, verifier, ticket };
};
const exchange = (clientId: string, code: string, verifier: string) =>
  fetch(origin + '/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      code_verifier: verifier,
      redirect_uri: 'https://client.example/callback',
      resource: resource.href,
      // Hosted clients may still send this after registration was normalized to public PKCE.
      client_secret: 'unused-secret',
    }),
  });
const grant = async (write: boolean) => {
  const started = await begin();
  const request = authorization.requests()[0];
  await authorization.decide(request.id, { approved: true, write });
  const redirect = new URL(authorization.connection(started.ticket).redirect!);
  expect(redirect.searchParams.get('state')).toBe('retained-state');
  const code = redirect.searchParams.get('code')!;
  expect((await exchange(started.client.client_id, code, 'wrong-verifier')).status).toBe(400);
  const response = await exchange(started.client.client_id, code, started.verifier);
  expect(response.status).toBe(200);
  const token = await response.json();
  expect(token.scope).toBe('pitchcrew:access');
  expect((await exchange(started.client.client_id, code, started.verifier)).status).toBe(400);
  return token.access_token as string;
};
const connect = async (token: string) => {
  const client = new Client({ name: 'remote-http-fixture', version: '1.0.0' });
  clients.push(client);
  await client.connect(
    new StreamableHTTPClientTransport(new URL(origin + '/mcp'), {
      requestInit: { headers: { authorization: `Bearer ${token}` } },
    }),
  );
  return client;
};

it('publishes canonical OAuth discovery, rejects untrusted hosts and authenticates before parsing MCP', async () => {
  const denied = await fetch(origin + '/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: 'not json',
  });
  expect(denied.status).toBe(401);
  expect(denied.headers.get('www-authenticate')).toContain(
    resource.origin + '/.well-known/oauth-protected-resource/mcp',
  );
  expect(denied.headers.get('set-cookie')).toBeNull();
  const metadata = await (await fetch(origin + '/.well-known/oauth-protected-resource/mcp')).json();
  expect(metadata.resource).toBe(resource.href);
  expect(metadata.scopes_supported).toEqual(['pitchcrew:access']);
  const issuer = await (await fetch(origin + '/.well-known/oauth-authorization-server')).json();
  expect(issuer.issuer).toBe(resource.origin + '/');
  expect(issuer.code_challenge_methods_supported).toEqual(['S256']);
  expect(issuer.token_endpoint_auth_methods_supported).toEqual(['none']);
  expect(issuer.scopes_supported).toEqual(['pitchcrew:access']);
  expect((await fetch(origin + '/api/snapshot')).status).toBe(404);
  expect((await fetch(origin + '/api/external-mcp/access')).status).toBe(404);
  const invalidHost = await new Promise<number | undefined>((resolve, reject) => {
    const request = httpRequest(
      origin + '/connection-check',
      { headers: { host: 'untrusted.example' } },
      (response) => {
        response.resume();
        resolve(response.statusCode);
      },
    );
    request.on('error', reject);
    request.end();
  });
  expect(invalidHost).toBe(403);
});

it('requires local consent and PKCE, serves concurrent stateless JSON tools, and revokes existing clients', async () => {
  const token = await grant(false);
  const client = await connect(token);
  const tools = (await client.listTools()).tools;
  expect(tools).toHaveLength(9);
  expect(tools.every((tool) => tool.annotations?.readOnlyHint)).toBe(true);
  const results = await Promise.all(
    Array.from({ length: 4 }, () => client.callTool({ name: 'pitchcrew_status', arguments: {} })),
  );
  expect(results.every((result) => !result.isError)).toBe(true);
  expect(results.map((result) => result.structuredContent)).toEqual(
    Array.from({ length: 4 }, () => ({ jobs: 0 })),
  );
  expect(call).toHaveBeenCalledTimes(4);
  expect(authorization.clients()[0].lastUsedAt).toBeTruthy();
  expect(
    (
      await client.callTool({
        name: 'pitchcrew_create_job',
        arguments: { company: 'Acme', title: 'Role' },
      })
    ).isError,
  ).toBe(true);
  expect(call).toHaveBeenCalledTimes(4);
  expect(
    (await fetch(origin + '/mcp', { headers: { authorization: `Bearer ${token}` } })).status,
  ).toBe(405);
  await authorization.revoke(authorization.clients()[0].id);
  await expect(client.callTool({ name: 'pitchcrew_status', arguments: {} })).rejects.toThrow();
});

it('exposes only the existing write allowlist after explicit write consent', async () => {
  const client = await connect(await grant(true));
  expect((await client.listTools()).tools).toHaveLength(15);
  expect(
    (
      await client.callTool({
        name: 'pitchcrew_create_job',
        arguments: { company: 'Acme', title: 'Role' },
      })
    ).isError,
  ).not.toBe(true);
  expect(call).toHaveBeenCalledWith('create_job', expect.objectContaining({ company: 'Acme' }));
  expect((await client.callTool({ name: 'pitchcrew_approve', arguments: {} })).isError).toBe(true);
  expect(call).toHaveBeenCalledTimes(1);
});

it('renders matching-code expiry and expired links in the same protected page shell', async () => {
  const { ticket } = await begin();
  const waiting = await fetch(`${origin}/connect/${ticket}`);
  expect(waiting.status).toBe(200);
  expect(waiting.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
  const page = await waiting.text();
  expect(page).toContain(authorization.requests()[0].code);
  expect(page).toContain(`<time datetime="${authorization.requests()[0].expiresAt}">`);
  expect(page).toContain('prefers-color-scheme:dark');
  const expired = await fetch(`${origin}/connect/${'0'.repeat(64)}`);
  expect(expired.status).toBe(410);
  expect(expired.headers.get('content-type')).toContain('text/html');
  expect(expired.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
  const expiredPage = await expired.text();
  expect(expiredPage).toContain('<h1>Connection request expired</h1>');
  expect(expiredPage).not.toContain('async function check');
});

it('keeps one connection rate bucket despite forwarded client addresses', async () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  for (let index = 0; index < 21; index++) {
    const response = await fetch(origin + '/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `198.51.100.${index + 1}` },
      body: JSON.stringify({
        client_name: 'Forwarded app',
        redirect_uris: ['https://client.example/callback'],
      }),
    });
    expect(response.status).toBe(index < 20 ? 201 : 429);
    await response.text();
  }
  expect(errors.mock.calls.flat().map(String).join(' ')).not.toContain(
    'ERR_ERL_UNEXPECTED_X_FORWARDED_FOR',
  );
});
