import { cardInput, type RunContext } from '@pitchcrew/core';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { vi } from 'vitest';

export const directories: string[] = [];
export async function contextFor(
  runtime:
    | 'gemini-cli'
    | 'opencode'
    | 'copilot-cli'
    | 'cursor-agent'
    | 'goose'
    | 'kiro-cli'
    | 'grok'
    | 'pi'
    | 'oh-my-pi'
    | 'hermes',
  mode = '',
): Promise<RunContext> {
  if (runtime === 'goose') vi.stubEnv('GOOSE_PROVIDER', 'openai');
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-adapter-'));
  directories.push(directory);
  return {
    card: {
      ...cardInput.parse({ company: 'Fixture', title: 'Engineer' }),
      id: 'fixture',
      state: 'lead',
      fit: null,
      owner: null,
      packet: null,
      feedback: [],
      createdAt: '',
      updatedAt: '',
      sample: true,
    },
    role: {
      id: 'scout',
      name: 'Scout',
      description: 'Fixture',
      runtime,
      model: '',
      enabled: true,
      instructions: 'Evaluate the fictional opportunity.',
    },
    profile: [{ name: 'profile.md', content: '# Fictional Candidate\n- Built café interfaces.' }],
    directory,
    mcp: {
      command: process.execPath,
      args: ['fixture-mcp.ts'],
      env: {
        PITCHCREW_RUN_TOKEN: 'fictional-token',
        PITCHCREW_DAEMON_URL: 'http://127.0.0.1:1',
        PITCHCREW_FIXTURE_MODE: mode,
      },
    },
    signal: new AbortController().signal,
    onMessage: vi.fn(),
  };
}
export async function requestFor(context: RunContext) {
  return JSON.parse(await readFile(join(context.directory, 'cli-request.json'), 'utf8')) as {
    runtime: string;
    args: string[];
    prompt: string;
    environment: Record<string, string>;
  };
}
export const cleanup = async () => {
  vi.unstubAllEnvs();
  for (const directory of directories.splice(0)) {
    if (!resolve(directory).startsWith(resolve(tmpdir(), 'pitchcrew-adapter-')))
      throw new Error('Refusing unsafe cleanup target.');
    await rm(directory, { recursive: true, force: true });
  }
};
