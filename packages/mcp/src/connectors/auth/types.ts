import type { ConnectorStatus } from '@pitchcrew/core';
import { type Server } from 'node:http';
import { GoogleToken, Store } from './helpers.ts';

export interface ConnectorManagerContext {
  directory: string;
  fetcher: typeof fetch;
  store: Store;
  pending?: { server: Server; timer: NodeJS.Timeout; state: string; busy: boolean };
  errors: { github: string; google: string };
  lifetimes: { github: AbortController; google: AbortController };
  refreshing?: { token: GoogleToken; promise: Promise<string> };
  saving: Promise<void>;
  githubConnecting: boolean;
  googleStarting: boolean;
  readonly folder: string;
  readonly file: string;
  initialize(): Promise<void>;
  status(): ConnectorStatus[];
  save(): Promise<void>;
  fetch(url: string | URL, init: RequestInit, lifetime: AbortSignal): Promise<Response>;
  connectGithub(value: unknown): Promise<ConnectorStatus[]>;
  connectGoogle(value: unknown): Promise<{ authorizationUrl: string }>;
  cancelPending(): void;
  disconnect(provider: 'github' | 'google'): Promise<ConnectorStatus[]>;
  googleAccessToken(token: GoogleToken, lifetime: AbortSignal): Promise<string>;
  call(name: string, input: unknown, signal: AbortSignal): Promise<Record<string, unknown>>;
  close(): Promise<void>;
}

export interface GoogleSignIn {
  clientId: string;
  clientSecret: string;
  state: string;
  verifier: string;
  lifetime: AbortSignal;
  redirectUri: () => string;
}
