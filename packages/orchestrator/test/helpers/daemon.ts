import type { SkillPreview, Snapshot } from '@pitchcrew/core';
import { baseSkillUrl, type BaseSkill } from '@pitchcrew/core/base-skills';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, vi } from 'vitest';
import { createDaemon } from '../../src/server.ts';

export const resources: { daemon: Awaited<ReturnType<typeof createDaemon>>; directory: string }[] =
  [];
export async function setup(port: number, seedSkills = false, dev = true) {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-test-'));
  const daemon = await createDaemon({ dev, directory, port, seedSkills });
  resources.push({ daemon, directory });
  await new Promise<void>((resolve) => daemon.http.listen(port, '127.0.0.1', resolve));
  const response = await fetch(daemon.url);
  const cookie = response.headers.get('set-cookie')!.split(';')[0];
  async function request<T>(
    path: string,
    method = 'GET',
    body?: unknown,
    extra: Record<string, string> = {},
  ) {
    const response = await fetch(`${daemon.url}/api${path}`, {
      method,
      headers: { cookie, 'x-pitchcrew-client': 'ui', 'content-type': 'application/json', ...extra },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const result = (await response.json()) as T;
    return { response, result };
  }
  return { daemon, directory, request, cookie };
}
export async function finish(request: <T>(path: string) => Promise<{ result: T }>, id: string) {
  for (let i = 0; i < 80; i++) {
    const { result } = await request<Snapshot>('/snapshot');
    const run = result.runs.find((run) => run.id === id);
    if (run && run.status !== 'running') {
      expect(run.status, run.message).toBe('completed');
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error('Run did not finish.');
}
export async function waitForSnapshot(
  request: <T>(path: string) => Promise<{ result: T }>,
  predicate: (snapshot: Snapshot) => boolean,
) {
  for (let i = 0; i < 150; i++) {
    const { result } = await request<Snapshot>('/snapshot');
    if (predicate(result)) return result;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error('Crew did not reach the expected state.');
}
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
export function starterFixture(
  starter: BaseSkill,
  content = `Fictional instructions for ${starter.name}.`,
): SkillPreview {
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
}
export const cleanup = async () => {
  vi.restoreAllMocks();
  for (const { daemon, directory } of resources.splice(0)) {
    await daemon.close();
    const prefix = resolve(tmpdir(), 'pitchcrew-test-');
    if (!resolve(directory).startsWith(prefix)) throw new Error('Refusing unsafe cleanup target.');
    await rm(directory, { recursive: true, force: true });
  }
};
