import { AsyncLocalStorage } from 'node:async_hooks';
import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { nodeExecutable } from '@pitchcrew/core/isolated-worker';
import type { RuntimeId } from '@pitchcrew/core';

export type RuntimeExecutables = Partial<Record<RuntimeId, string>>;
const executables = new AsyncLocalStorage<RuntimeExecutables>();
const commands: Record<string, RuntimeId> = {
  claude: 'claude-code',
  codex: 'codex',
  gemini: 'gemini-cli',
  opencode: 'opencode',
  copilot: 'copilot-cli',
  'cursor-agent': 'cursor-agent',
  goose: 'goose',
  'kiro-cli': 'kiro-cli',
  grok: 'grok',
  pi: 'pi',
  omp: 'oh-my-pi',
  hermes: 'hermes',
};

/** A workspace's executable choices follow only its asynchronous launch chain. */
export const withRuntimeExecutables = <T>(paths: RuntimeExecutables, action: () => T): T =>
  executables.run({ ...paths }, action);

export const runtimeExecutable = (command: string): string => {
  const id = commands[command];
  return id ? (executables.getStore()?.[id] ?? command) : command;
};

/** Run verified npm shims through Node, never cmd.exe or another shell. */
export const runtimeCommand = (command: string, args: string[]) => {
  const file = runtimeExecutable(command);
  if (!isAbsolute(file) || !/\.(?:cmd|bat)$/i.test(file)) return { file, args };
  const text = readFileSync(file, 'utf8');
  if (text.length > 16000) throw new Error('The runtime command shim is too large.');
  const match = text.match(/"%dp0%[\\/]([^"\r\n]+)"\s+%\*/i);
  if (!match) throw new Error('Use a native executable or an npm-generated runtime command.');
  const target = resolve(dirname(file), match[1]);
  const root = join(dirname(file), 'node_modules') + sep;
  if (!target.startsWith(root))
    throw new Error('The runtime command shim points outside node_modules.');
  return { file: nodeExecutable(), args: [target, ...args] };
};
