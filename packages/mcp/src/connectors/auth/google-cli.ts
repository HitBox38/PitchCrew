import { z } from 'zod';
import { googleScopes } from './helpers.ts';
import { GoogleCliMissingError } from './google-cli-process.ts';
import { googleCliArgs } from './google-cli-requests.ts';
import type { ConnectorManagerContext } from './types.ts';
import type { ConnectorRequest } from '../tools/helpers.ts';

const accountSchema = z.object({
  token_valid: z.literal(true),
  user: z.email(),
  scopes: z.array(z.string()),
});
const broaderScopes: Record<string, string[]> = {
  gmail: ['https://www.googleapis.com/auth/gmail.modify', 'https://mail.google.com/'],
  drive: ['https://www.googleapis.com/auth/drive'],
  sheets: ['https://www.googleapis.com/auth/spreadsheets'],
  calendar: ['https://www.googleapis.com/auth/calendar'],
};
export function googleCliServices(scopes: readonly string[]) {
  return Object.entries(googleScopes)
    .filter(([service, scope]) =>
      [scope, ...broaderScopes[service]!].some((grant) => scopes.includes(grant)),
    )
    .map(([service]) => service);
}
async function account(context: ConnectorManagerContext, signal: AbortSignal) {
  const result = await context.runGoogleCli(['auth', 'status'], signal);
  signal.throwIfAborted();
  let parsed: ReturnType<typeof accountSchema.safeParse>;
  try {
    parsed = accountSchema.safeParse(JSON.parse(result.stdout));
  } catch {
    throw new Error(
      'Google Workspace CLI returned an unsupported account response. Update gws and try again.',
    );
  }
  if (result.exitCode !== 0 || !parsed.success) {
    context.googleCliState = 'signed_out';
    throw new Error('Sign in with gws auth login --readonly, then try connecting again.');
  }
  return parsed.data;
}
export async function connectGoogleCli(this: ConnectorManagerContext) {
  if (this.googleStarting || this.pending)
    throw new Error('Google sign-in is already in progress.');
  if (this.store.google)
    throw new Error('Disconnect the current Google account before connecting again.');
  this.googleStarting = true;
  this.errors.google = '';
  const signal = this.lifetimes.google.signal;
  try {
    const version = await this.runGoogleCli(['--version'], signal);
    if (version.exitCode !== 0)
      throw new Error('Google Workspace CLI could not start. Check its installation.');
    const current = await account(this, signal);
    if (!googleCliServices(current.scopes).length) {
      this.googleCliState = 'scopes_missing';
      throw new Error(
        'No supported Google read permissions were granted. Run gws auth login --readonly and reconnect.',
      );
    }
    signal.throwIfAborted();
    this.store.google = { mode: 'cli', account: current.user, scopes: current.scopes };
    this.googleCliState = 'ready';
    await this.save();
    this.googleStarting = false;
    return this.status();
  } catch (error) {
    if (!signal.aborted && error instanceof GoogleCliMissingError) this.googleCliState = 'missing';
    if (!signal.aborted)
      this.errors.google =
        error instanceof Error ? error.message : 'Google Workspace CLI connection failed.';
    throw error;
  } finally {
    this.googleStarting = false;
  }
}
export async function googleCliRead(
  context: ConnectorManagerContext,
  name: string,
  request: ConnectorRequest,
  permission: string,
  signal: AbortSignal,
) {
  const binding = context.store.google;
  if (!binding || !('mode' in binding)) throw new Error('Google Workspace CLI is not connected.');
  const args = googleCliArgs(name, request);
  const current = await account(context, signal);
  if (current.user.toLowerCase() !== binding.account.toLowerCase()) {
    context.googleCliState = 'account_changed';
    throw new Error(
      'The Google Workspace CLI account changed. Disconnect and reconnect Google in Settings → Accounts.',
    );
  }
  if (JSON.stringify(current.scopes) !== JSON.stringify(binding.scopes)) {
    binding.scopes = current.scopes;
    await context.save();
    signal.throwIfAborted();
  }
  if (!googleCliServices(current.scopes).includes(permission)) {
    context.googleCliState = 'scopes_missing';
    throw new Error(
      'This Google service was not granted. Run gws auth login --readonly and reconnect.',
    );
  }
  const result = await context.runGoogleCli(args, signal, !!request.text);
  signal.throwIfAborted();
  if (result.exitCode !== 0)
    throw new Error(
      'Google Workspace CLI read failed. Check granted permissions, enabled APIs and the resource, then retry.',
    );
  context.googleCliState = 'ready';
  if (request.text) {
    if (result.text === undefined)
      throw new Error('Google Workspace CLI returned an unsupported download response.');
    return { text: result.text, source: request.url.origin + request.url.pathname };
  }
  try {
    return JSON.parse(result.stdout) as unknown;
  } catch {
    throw new Error(
      'Google Workspace CLI returned an unsupported read response. Update gws and try again.',
    );
  }
}
