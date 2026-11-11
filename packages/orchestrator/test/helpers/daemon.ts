import { adapters } from '@pitchcrew/adapters';
import type {
  RuntimeAdapter,
  RuntimeId,
  SkillPreview,
  Snapshot,
  ExtractedJob,
} from '@pitchcrew/core';
import { baseSkillUrl, type BaseSkill } from '@pitchcrew/core/base-skills';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, type AddressInfo, type Server } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, vi } from 'vitest';
import { type DaemonOptions, createDaemon } from '../../src/server.ts';

/**
 * Holds an OS-assigned loopback port, so parallel test files never share a fixed number. The
 * daemon must know its port before it starts (its URL and Host/Origin checks use it); `listen`
 * releases the reservation and binds the server to the same port in one step.
 */
export const reservePort = async () => {
  const holder = createServer();
  await new Promise<void>((resolve, reject) => {
    holder.once('error', reject);
    holder.listen(0, '127.0.0.1', () => {
      holder.off('error', reject);
      resolve();
    });
  });
  const { port } = holder.address() as AddressInfo;
  const release = () => {
    if (holder.listening) holder.close();
  };
  const listen = (server: Server) =>
    new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      release();
      server.listen(port, '127.0.0.1', () => {
        server.off('error', reject);
        resolve();
      });
    });
  return { port, listen, release };
};

type NativeCheck = 'detect' | 'listModels';
const isolated = new Map<RuntimeAdapter, Partial<Pick<RuntimeAdapter, NativeCheck>>>();
const fixtureChecks = (adapter: RuntimeAdapter): Pick<RuntimeAdapter, NativeCheck> => ({
  detect: async () => ({
    id: adapter.id,
    available: false,
    version: '',
    detail: 'Native runtime detection is outside test fixtures.',
  }),
  listModels: async () => {
    throw new Error('Native model discovery is outside test fixtures.');
  },
});
/**
 * Replaces native CLI checks with an unavailable result, so test daemons never run installed
 * provider CLIs (`--version` or model listing) under the developer's accounts. Checks a test
 * already mocked keep that mock; `native` lists runtimes a test deliberately detects for real.
 * Plain assignment (not a spy) survives `vi.restoreAllMocks()`; `restoreRuntimes` undoes it.
 */
export const isolateRuntimes = (native: readonly RuntimeId[] = []) => {
  for (const adapter of Object.values(adapters) as RuntimeAdapter[]) {
    if (adapter.id === 'demo') continue;
    const originals = isolated.get(adapter) ?? {};
    if (native.includes(adapter.id)) {
      Object.assign(adapter, originals);
      isolated.delete(adapter);
      continue;
    }
    const fixture = fixtureChecks(adapter);
    for (const check of ['detect', 'listModels'] as const) {
      const current = adapter[check];
      if (!current || check in originals || vi.isMockFunction(current)) continue;
      Object.assign(originals, { [check]: current });
      Object.assign(adapter, { [check]: fixture[check] });
    }
    isolated.set(adapter, originals);
  }
};
export const restoreRuntimes = () => {
  for (const [adapter, originals] of isolated) Object.assign(adapter, originals);
  isolated.clear();
};

export const setup = async (
  seedSkills = false,
  {
    nativeRuntimes = [],
    ...options
  }: Pick<DaemonOptions, 'dev' | 'browserLaunch' | 'ui' | 'uiCache'> & {
    /** Runtimes whose installed CLI this test deliberately detects; all others are isolated. */
    nativeRuntimes?: readonly RuntimeId[];
  } = {},
) => {
  const request = async <T>(
    path: string,
    method = 'GET',
    body?: unknown,
    extra: Record<string, string> = {},
  ) => {
    const response = await fetch(`${daemon.url}/api${path}`, {
      method,
      headers: { cookie, 'x-pitchcrew-client': 'ui', 'content-type': 'application/json', ...extra },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const result = (await response.json()) as T;
    return { response, result };
  };

  isolateRuntimes(nativeRuntimes);
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-test-'));
  const reservation = await reservePort();
  const { port } = reservation;
  let daemon: Awaited<ReturnType<typeof createDaemon>>;
  try {
    daemon = await createDaemon({
      directory,
      port,
      seedSkills,
      dev: true,
      ui: false,
      ...options,
    });
  } catch (error) {
    reservation.release();
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  resources.push({ daemon, directory });
  await reservation.listen(daemon.http);
  const response = await fetch(daemon.url);
  const cookie = response.headers.get('set-cookie')!.split(';')[0];
  return { daemon, directory, request, cookie, port };
};
export const finish = async (request: <T>(path: string) => Promise<{ result: T }>, id: string) => {
  for (let i = 0; i < 250; i++) {
    const { result } = await request<Snapshot>('/snapshot');
    const run = result.runs.find((run) => run.id === id);
    if (run && run.status !== 'running') {
      expect(run.status, run.message).toBe('completed');
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error('Run did not finish.');
};
/** Explicit UI confirmation used by existing fictional workflow fixtures. */
export const confirmFixtureApplication = async (
  request: Awaited<ReturnType<typeof setup>>['request'],
  id: string,
) => {
  const { result } = await request<{
    sourceRevision: string;
    context: { revision: string } | null;
    form: ExtractedJob['form'] | null;
  }>(`/cards/${id}/application-context`);
  const response = await request(`/cards/${id}/application-context/confirm`, 'POST', {
    sourceRevision: result.sourceRevision,
    expectedRevision: result.context?.revision ?? null,
    context: {
      brief: {
        companyContext: 'Fictional fixture employer.',
        responsibilities: ['Build interfaces.'],
        qualifications: ['React and TypeScript.'],
        constraints: [],
      },
      requirements: [],
      flagged: [],
      form: result.form ?? { status: 'manual' },
    },
  });
  expect(response.response.status).toBe(200);
};
export const waitForSnapshot = async (
  request: <T>(path: string) => Promise<{ result: T }>,
  predicate: (snapshot: Snapshot) => boolean,
) => {
  for (let i = 0; i < 300; i++) {
    const { result } = await request<Snapshot>('/snapshot');
    if (predicate(result)) return result;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error('Crew did not reach the expected state.');
};

export const starterFixture = (
  starter: BaseSkill,
  content = `Fictional instructions for ${starter.name}.`,
): SkillPreview => {
  if (starter.sourceType === 'bundled')
    return {
      name: starter.name,
      description: starter.description,
      content: starter.content,
      bundledId: starter.name,
    };
  return {
    name: starter.name,
    description: 'Use this fictional fixture when relevant.',
    content,
    source: {
      url: baseSkillUrl(starter),
      repository: starter.source,
      path: starter.skillPath,
      blobSha: 'a'.repeat(40),
      fetchedAt: '2026-10-02T00:00:00.000Z',
    },
  };
};

export const resources: { daemon: Awaited<ReturnType<typeof createDaemon>>; directory: string }[] =
  [];
export const directorySkill: SkillPreview = {
  name: 'evidence-checklist',
  description: 'Check each profile quotation.',
  content: '# Evidence checklist\n\nCheck every claim against an exact profile quote.',
  source: {
    url: 'https://skills.sh/fictional/crew-skills/evidence-checklist',
    repository: 'fictional/crew-skills',
    path: 'skills/evidence-checklist/SKILL.md',
    blobSha: 'a'.repeat(40),
    fetchedAt: '2026-10-02T00:00:00.000Z',
  },
};
export const cleanup = async () => {
  vi.restoreAllMocks();
  restoreRuntimes();
  for (const { daemon, directory } of resources.splice(0)) {
    await daemon.close();
    const prefix = resolve(tmpdir(), 'pitchcrew-test-');
    if (!resolve(directory).startsWith(prefix)) throw new Error('Refusing unsafe cleanup target.');
    await rm(directory, { recursive: true, force: true });
  }
};
