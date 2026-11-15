import { randomBytes, randomUUID } from 'node:crypto';
import type {
  OAuthServerProvider,
  AuthorizationParams,
} from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import {
  InvalidClientError,
  InvalidGrantError,
  InvalidRequestError,
  InvalidTokenError,
  ServerError,
  TooManyRequestsError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js';
import type { RemoteMcpClient, RemoteMcpRequest } from '@pitchcrew/core';
import {
  assertRedirect,
  assertVerifier,
  hashToken,
  redirectMatches,
  requestedScopes,
} from './authorization-validation.ts';
import {
  clientSchema,
  grantLifetime,
  readAuthorizationState,
  readScope,
  oauthScope,
  writeAuthorizationState,
  writeScope,
  type AuthorizationState,
  type RegisteredClient,
  type StoredGrant,
  type RemoteScope,
} from './authorization-state.ts';

const pendingLifetime = 10 * 60 * 1000;
const codeLifetime = 60 * 1000;
const accessLifetime = 60 * 60 * 1000;
type Pending = {
  id: string;
  ticket: string;
  code: string;
  clientId: string;
  name: string;
  redirectUri: string;
  challenge: string;
  scopes: RemoteScope[];
  state?: string;
  createdAt: number;
  expiresAt: number;
  status: 'waiting' | 'approved' | 'denied';
  authorizationCode?: string;
  codeExpiresAt?: number;
  grantedScopes?: RemoteScope[];
};

export class RemoteAuthorization implements OAuthServerProvider {
  private pending = new Map<string, Pending>();
  private saving: Promise<void> = Promise.resolve();
  private constructor(
    private directory: string,
    private resource: URL,
    private state: AuthorizationState,
  ) {}

  static async open(directory: string, resource: URL) {
    assertRedirect(resource.href);
    if (resource.search || resource.hash || resource.pathname !== '/mcp')
      throw new Error('Remote MCP requires a canonical /mcp resource address.');
    const state = await readAuthorizationState(directory);
    if (
      new Set(state.clients.map((client) => client.info.client_id)).size !== state.clients.length ||
      new Set(state.grants.map((grant) => grant.id)).size !== state.grants.length ||
      state.grants.some(
        (grant) => !state.clients.some((client) => client.info.client_id === grant.clientId),
      )
    )
      throw new Error(
        'Remote app access file is unreadable. Restore remote-mcp.json before starting a connection.',
      );
    return new RemoteAuthorization(directory, new URL(resource), state);
  }

  readonly clientsStore: OAuthRegisteredClientsStore = {
    getClient: (id) => {
      const record = this.clientRecord(id);
      return record ? structuredClone(record.info) : undefined;
    },
    registerClient: async (input) => {
      const redirects = input.redirect_uris;
      if (!Array.isArray(redirects) || redirects.length < 1 || redirects.length > 8)
        throw new InvalidRequestError('Supply between one and eight app callback addresses.');
      for (const redirect of redirects) assertRedirect(redirect);
      const name = input.client_name?.trim() || 'Unnamed app';
      if (name.length > 80)
        throw new InvalidRequestError('App names are limited to 80 characters.');
      const scopes = requestedScopes(input.scope?.split(' ').filter(Boolean));
      const info = clientSchema.parse({
        client_id: randomUUID(),
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_name: name,
        redirect_uris: [...new Set(redirects)],
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        scope: scopes.join(' '),
      });
      await this.mutate((state) => {
        if (state.clients.length >= 100)
          throw new TooManyRequestsError(
            'Too many app registrations. Stop and restart the temporary connection.',
          );
        state.clients.push({ info, expiresAt: Date.now() + grantLifetime });
      });
      return structuredClone(info);
    },
  };

  private clientRecord(id: string) {
    return this.state.clients.find(
      (client) =>
        client.info.client_id === id &&
        (client.expiresAt > Date.now() ||
          this.state.grants.some((grant) => grant.clientId === id && grant.expiresAt > Date.now())),
    );
  }

  private requireClient(client: Pick<OAuthClientInformationFull, 'client_id'>): RegisteredClient {
    const registered = this.clientRecord(client.client_id);
    if (!registered)
      throw new InvalidClientError('Unknown or expired app registration. Connect again.');
    return registered.info;
  }

  private assertResource(resource?: URL) {
    if (resource && resource.href !== this.resource.href)
      throw new InvalidGrantError(
        'This connection belongs to a different MCP address. Connect again.',
      );
  }

  private prunePending() {
    for (const [ticket, pending] of this.pending)
      if (
        pending.expiresAt <= Date.now() ||
        (pending.codeExpiresAt !== undefined && pending.codeExpiresAt <= Date.now())
      )
        this.pending.delete(ticket);
  }

  private mutate<T>(
    operation: (state: AuthorizationState) => T,
    committed?: (value: T) => void,
  ): Promise<T> {
    const result = this.saving.then(async () => {
      const candidate = structuredClone(this.state);
      candidate.grants = candidate.grants.filter((grant) => grant.expiresAt > Date.now());
      candidate.clients = candidate.clients.filter(
        (client) =>
          client.expiresAt > Date.now() ||
          candidate.grants.some((grant) => grant.clientId === client.info.client_id),
      );
      const value = operation(candidate);
      if (JSON.stringify(candidate) === JSON.stringify(this.state)) {
        committed?.(value);
        return value;
      }
      try {
        await writeAuthorizationState(this.directory, candidate);
      } catch {
        throw new ServerError(
          'Could not save remote app access. Check the workspace data folder and try again.',
        );
      }
      this.state = candidate;
      committed?.(value);
      return value;
    });
    this.saving = result.then(
      () => {},
      () => {},
    );
    return result;
  }

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Parameters<OAuthServerProvider['authorize']>[2],
  ) {
    const registered = this.requireClient(client);
    this.assertResource(params.resource);
    if (!/^[a-zA-Z0-9_-]{43}$/.test(params.codeChallenge) || (params.state?.length ?? 0) > 2048)
      throw new InvalidRequestError('Use S256 PKCE and a bounded authorization state.');
    if (!registered.redirect_uris.some((redirect) => redirectMatches(params.redirectUri, redirect)))
      throw new InvalidRequestError('Unregistered app callback address.');
    requestedScopes(params.scopes);
    this.prunePending();
    if (this.pending.size >= 20)
      throw new TooManyRequestsError(
        'Too many connection requests. Finish or wait for existing requests to expire.',
      );
    const ticket = randomBytes(32).toString('hex');
    const code = randomBytes(4).toString('hex').toUpperCase();
    this.pending.set(ticket, {
      id: randomUUID(),
      ticket,
      code: `${code.slice(0, 4)}-${code.slice(4)}`,
      clientId: registered.client_id,
      name: registered.client_name,
      redirectUri: params.redirectUri,
      challenge: params.codeChallenge,
      scopes: [readScope, writeScope],
      state: params.state,
      createdAt: Date.now(),
      expiresAt: Date.now() + pendingLifetime,
      status: 'waiting',
    });
    res.redirect(`${this.resource.origin}/connect/${ticket}`);
  }

  requests(): RemoteMcpRequest[] {
    this.prunePending();
    return [...this.pending.values()]
      .filter((request) => request.status === 'waiting')
      .map((request) => ({
        id: request.id,
        code: request.code,
        name: request.name,
        redirectHost: new URL(request.redirectUri).host,
        scopes: [...request.scopes],
        createdAt: new Date(request.createdAt).toISOString(),
        expiresAt: new Date(request.expiresAt).toISOString(),
      }));
  }

  clients(): RemoteMcpClient[] {
    return this.state.grants
      .filter((grant) => grant.expiresAt > Date.now() && grant.resource === this.resource.href)
      .map((grant) => ({
        id: grant.id,
        name: grant.name,
        write: grant.scopes.includes(writeScope),
        createdAt: new Date(grant.createdAt).toISOString(),
        expiresAt: new Date(grant.expiresAt).toISOString(),
        ...(grant.lastUsedAt ? { lastUsedAt: new Date(grant.lastUsedAt).toISOString() } : {}),
      }));
  }

  async decide(id: string, decision: { approved: boolean; write: boolean }) {
    await this.saving;
    this.prunePending();
    const pending = [...this.pending.values()].find((request) => request.id === id);
    if (!pending || pending.status !== 'waiting')
      throw new InvalidRequestError('This connection request has expired or was already decided.');
    if (!decision.approved) {
      pending.status = 'denied';
      pending.expiresAt = Math.min(pending.expiresAt, Date.now() + codeLifetime);
      return;
    }
    this.requireClient({ client_id: pending.clientId });
    pending.grantedScopes = decision.write ? [readScope, writeScope] : [readScope];
    pending.authorizationCode = randomBytes(32).toString('hex');
    pending.codeExpiresAt = Date.now() + codeLifetime;
    pending.status = 'approved';
  }

  connection(ticket: string): {
    status: 'waiting' | 'approved' | 'denied' | 'expired';
    code?: string;
    expiresAt?: string;
    redirect?: string;
  } {
    this.prunePending();
    const request = /^[a-f0-9]{64}$/.test(ticket) ? this.pending.get(ticket) : undefined;
    if (!request || (request.status === 'approved' && request.codeExpiresAt! <= Date.now()))
      return { status: 'expired' };
    if (request.status === 'waiting')
      return {
        status: 'waiting',
        code: request.code,
        expiresAt: new Date(request.expiresAt).toISOString(),
      };
    const redirect = new URL(request.redirectUri);
    if (request.state !== undefined) redirect.searchParams.set('state', request.state);
    redirect.searchParams.set('iss', new URL('/', this.resource).href);
    if (request.status === 'approved')
      redirect.searchParams.set('code', request.authorizationCode!);
    else redirect.searchParams.set('error', 'access_denied');
    return { status: request.status, code: request.code, redirect: redirect.href };
  }

  private requireCode(client: OAuthClientInformationFull, code: string) {
    this.requireClient(client);
    this.prunePending();
    const pending = [...this.pending.values()].find(
      (request) => request.authorizationCode === code,
    );
    if (
      !pending ||
      pending.status !== 'approved' ||
      pending.clientId !== client.client_id ||
      pending.codeExpiresAt! <= Date.now()
    )
      throw new InvalidGrantError('Invalid or expired authorization grant. Connect again.');
    return pending;
  }

  async challengeForAuthorizationCode(client: OAuthClientInformationFull, code: string) {
    return this.requireCode(client, code).challenge;
  }

  private issueTokens(grant: StoredGrant, accessToken: string, refreshToken: string): OAuthTokens {
    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: Math.floor((grant.accessExpiresAt - Date.now()) / 1000),
      refresh_token: refreshToken,
      scope: oauthScope,
    };
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    code: string,
    codeVerifier?: string,
    redirectUri?: string,
    resource?: URL,
  ) {
    this.assertResource(resource);
    return this.mutate(
      (state) => {
        const request = this.requireCode(client, code);
        if (redirectUri !== request.redirectUri)
          throw new InvalidGrantError('Authorization callback does not match.');
        // The SDK validates PKCE before calling this method without a verifier.
        if (codeVerifier !== undefined) assertVerifier(codeVerifier, request.challenge);
        if (state.grants.length >= 50)
          throw new TooManyRequestsError(
            'Too many connected apps. Revoke an unused connection first.',
          );
        const accessToken = randomBytes(32).toString('hex');
        const refreshToken = randomBytes(32).toString('hex');
        const grant: StoredGrant = {
          id: randomUUID(),
          clientId: request.clientId,
          name: request.name,
          resource: this.resource.href,
          scopes: request.grantedScopes!,
          createdAt: Date.now(),
          expiresAt: Date.now() + grantLifetime,
          accessHash: hashToken(accessToken),
          accessExpiresAt: Date.now() + accessLifetime,
          refreshHash: hashToken(refreshToken),
        };
        state.grants.push(grant);
        state.clients.find((entry) => entry.info.client_id === request.clientId)!.expiresAt =
          grant.expiresAt;
        return {
          ticket: request.ticket,
          tokens: this.issueTokens(grant, accessToken, refreshToken),
        };
      },
      ({ ticket }) => this.pending.delete(ticket),
    ).then(({ tokens }) => tokens);
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    resource?: URL,
  ) {
    this.assertResource(resource);
    this.requireClient(client);
    requestedScopes(scopes);
    if (!/^[a-f0-9]{64}$/.test(refreshToken)) throw new InvalidGrantError('Invalid refresh grant.');
    return this.mutate((state) => {
      const grant = state.grants.find(
        (entry) =>
          entry.clientId === client.client_id &&
          entry.refreshHash === hashToken(refreshToken) &&
          entry.resource === this.resource.href,
      );
      if (!grant) throw new InvalidGrantError('Invalid or expired refresh grant. Connect again.');
      const accessToken = randomBytes(32).toString('hex');
      const nextRefresh = randomBytes(32).toString('hex');
      grant.accessHash = hashToken(accessToken);
      grant.accessExpiresAt = Math.min(Date.now() + accessLifetime, grant.expiresAt);
      grant.refreshHash = hashToken(nextRefresh);
      return this.issueTokens(grant, accessToken, nextRefresh);
    });
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    await this.saving;
    if (!/^[a-f0-9]{64}$/.test(token))
      throw new InvalidTokenError('Remote access is expired or revoked. Connect again.');
    const grant = this.state.grants.find(
      (entry) =>
        entry.accessHash === hashToken(token) &&
        entry.resource === this.resource.href &&
        entry.accessExpiresAt > Date.now() &&
        entry.expiresAt > Date.now(),
    );
    if (!grant) throw new InvalidTokenError('Remote access is expired or revoked. Connect again.');
    return {
      token,
      clientId: grant.clientId,
      scopes: [oauthScope],
      expiresAt: Math.floor(grant.accessExpiresAt / 1000),
      resource: new URL(grant.resource),
      extra: { grantId: grant.id, write: grant.scopes.includes(writeScope) },
    };
  }

  async revoke(id: string) {
    await this.mutate((state) => {
      state.grants = state.grants.filter((grant) => grant.id !== id);
    });
  }
  async revokeAll() {
    await this.mutate(
      (state) => {
        state.grants = [];
        state.clients = [];
      },
      () => this.pending.clear(),
    );
  }
  async revokeToken(client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest) {
    await this.mutate((state) => {
      state.grants = state.grants.filter(
        (grant) =>
          grant.clientId !== client.client_id ||
          (grant.accessHash !== hashToken(request.token) &&
            grant.refreshHash !== hashToken(request.token)),
      );
    });
  }
  async touch(id: string) {
    const current = this.state.grants.find(
      (grant) => grant.id === id && grant.expiresAt > Date.now(),
    );
    if (!current || (current.lastUsedAt && Date.now() - current.lastUsedAt < 60_000)) return;
    await this.mutate((state) => {
      const grant = state.grants.find((entry) => entry.id === id);
      if (grant && (!grant.lastUsedAt || Date.now() - grant.lastUsedAt >= 60_000))
        grant.lastUsedAt = Date.now();
    });
  }
}
