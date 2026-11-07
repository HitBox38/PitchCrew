import { AsyncLocalStorage } from 'node:async_hooks';
import type { RuntimeId } from '@pitchcrew/core';
import {
  runtimeConnectionSecretNames,
  validateRuntimeConnectionValue,
} from './runtime-connection-fields.ts';

const connections = new AsyncLocalStorage<{
  runtime: RuntimeId;
  environment: Record<string, string>;
  authenticationDirectory?: string;
}>();

/** Credentials follow only this workspace's asynchronous runtime operation. */
export const withRuntimeConnection = <T>(
  runtime: RuntimeId,
  environment: Record<string, string>,
  action: () => T,
  authenticationDirectory?: string,
): T => {
  for (const [name, value] of Object.entries(environment))
    validateRuntimeConnectionValue(runtime, name, value);
  return connections.run(
    { runtime, environment: { ...environment }, authenticationDirectory },
    action,
  );
};
export const runtimeConnectionEnvironment = (): NodeJS.ProcessEnv => ({
  ...process.env,
  ...connections.getStore()?.environment,
});
export const runtimeConnectionDirectory = () => connections.getStore()?.authenticationDirectory;

export const redactRuntimeConnectionSecrets = (text: string): string => {
  let result = text;
  for (const [key, value] of Object.entries(runtimeConnectionEnvironment()))
    if (
      value &&
      (runtimeConnectionSecretNames.has(key) ||
        (/TOKEN|SECRET|PASSWORD|API_KEY|AUTH/i.test(key) && value.length >= 4))
    )
      result = result.replaceAll(value, '[redacted]');
  return result;
};
