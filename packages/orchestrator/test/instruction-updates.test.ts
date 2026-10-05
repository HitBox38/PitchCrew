import { adapters } from '@pitchcrew/adapters';
import { defaultInstructionHistory, defaultRoles } from '@pitchcrew/board';
import type { InstructionUpdate, Role, Snapshot } from '@pitchcrew/core';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InstructionUpdatePreferences } from '../src/instruction-updates.ts';
import { createDaemon } from '../src/server.ts';
import { cleanup, finish, resources, setup } from './helpers/daemon.ts';

afterEach(async () => {
  for (const { daemon } of resources) daemon.service.capabilities.delete('update-token');
  await cleanup();
});

const firstScout =
  'Evaluate the provided job against the profile. Explain the fit. Never invent jobs or qualifications.';
const firstWriter =
  'Write a tailored application packet. Every factual claim must appear verbatim in a profile source and include a source and quote. Never invent achievements.';
const current = Object.fromEntries(
  defaultRoles('claude-code', false).map((role) => [role.id, role.instructions]),
);
const latest = (id: string) => defaultInstructionHistory[id].at(-1)!.revision;

/** Closes running daemons for this directory and starts a new one, as a restart does. */
async function restart(directory: string, port: number) {
  for (const entry of resources.splice(0)) await entry.daemon.close();
  const daemon = await createDaemon({ directory, port, seedSkills: false, dev: true });
  resources.push({ daemon, directory });
  await new Promise<void>((resolve) => daemon.http.listen(port, '127.0.0.1', resolve));
  return daemon;
}

async function fixture(port: number) {
  const context = await setup(port);
  const { daemon, request } = context;
  const seedOld = (id: string, instructions: string) => {
    const role = daemon.service.board.get<Role>('role', id);
    daemon.service.board.record('role', { ...role, instructions }, 'system', 'Fixture old seed');
  };
  const updates = async () =>
    (await request<Snapshot>('/snapshot')).result.instructionUpdates ?? [];
  return { ...context, seedOld, updates };
}

describe('default instruction updates', () => {
  it('lists updates for seeded defaults without changing any role', async () => {
    const { daemon, seedOld, updates } = await fixture(15611);
    expect(await updates()).toEqual([]);
    seedOld('scout', firstScout);
    seedOld('writer', firstWriter);
    const writer = daemon.service.board.get<Role>('role', 'writer');
    daemon.service.board.record(
      'role',
      { ...writer, instructions: `${firstWriter} Keep a warm tone.` },
      'user',
      'Fixture customization',
    );
    const before = daemon.service.board.events(1)[0].id;
    const list = await updates();
    expect(list.map((item) => [item.roleId, item.state, item.dismissed])).toEqual([
      ['scout', 'unedited', false],
      ['writer', 'customized', false],
    ]);
    expect(list[1]).toMatchObject<Partial<InstructionUpdate>>({
      revision: latest('writer'),
      instructions: current.writer,
      base: { revision: defaultInstructionHistory.writer[0].revision, instructions: firstWriter },
    });
    expect(daemon.service.board.events(1)[0].id).toBe(before);
    expect(daemon.service.board.get<Role>('role', 'scout').instructions).toBe(firstScout);
  });

  it('adopts the new default through the user settings path and refreshes generated files', async () => {
    let complete!: (reply: { reply: string }) => void;
    vi.spyOn(adapters.demo, 'chat').mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const { daemon, directory, request, seedOld, updates } = await fixture(15612);
    seedOld('scout', firstScout);
    const scout = daemon.service.board.get<Role>('role', 'scout');
    const run = await daemon.service.sendChat('scout', { content: 'Fictional question' });
    await vi.waitFor(() => expect(complete).toBeTypeOf('function'));
    const blocked = await request<{ error: string }>(
      '/roles/scout/instructions-update/adopt',
      'POST',
      { revision: latest('scout') },
    );
    expect(blocked.response.status).toBe(400);
    expect(blocked.result.error).toContain('active run');
    expect(daemon.service.board.get<Role>('role', 'scout').instructions).toBe(firstScout);
    complete({ reply: 'Fictional answer' });
    await finish(request, run.id);

    const stale = await request<{ error: string }>(
      '/roles/scout/instructions-update/adopt',
      'POST',
      { revision: defaultInstructionHistory.scout[1].revision },
    );
    expect(stale.result.error).toContain('Review the latest update');
    expect(
      (await request('/roles/scout/instructions-update/adopt', 'POST', {})).response.status,
    ).toBe(400);

    const adopted = await request<Role>('/roles/scout/instructions-update/adopt', 'POST', {
      revision: latest('scout'),
    });
    expect(adopted.response.status).toBe(200);
    expect(adopted.result).toMatchObject({
      instructions: current.scout,
      runtime: scout.runtime,
      model: scout.model,
      enabled: scout.enabled,
      name: scout.name,
    });
    const event = daemon.service.board.events(1)[0];
    expect(event).toMatchObject({
      kind: 'role',
      actor: 'user',
      message: 'Used the new default instructions for Scout',
    });
    expect(await readFile(join(directory, 'roles', 'scout', 'AGENTS.md'), 'utf8')).toContain(
      current.scout,
    );
    expect(await updates()).toEqual([]);
    const again = await request<{ error: string }>(
      '/roles/scout/instructions-update/adopt',
      'POST',
      { revision: latest('scout') },
    );
    expect(again.result.error).toContain('no default instructions update');
  });

  it('keeps a dismissal across restarts until a newer revision ships', async () => {
    const { daemon, directory, request, seedOld } = await fixture(15614);
    seedOld('writer', firstWriter);
    const dismissed = await request<InstructionUpdate>(
      '/roles/writer/instructions-update/dismiss',
      'POST',
      { revision: latest('writer') },
    );
    expect(dismissed.result).toMatchObject({ roleId: 'writer', dismissed: true });
    expect(daemon.service.board.get<Role>('role', 'writer').instructions).toBe(firstWriter);
    const file = join(directory, 'instruction-updates.json');
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({
      version: 1,
      dismissed: { writer: latest('writer') },
    });

    const writerUpdate = async (port: number) => {
      const restarted = await restart(directory, port);
      return (await restarted.service.snapshot()).instructionUpdates?.find(
        (item) => item.roleId === 'writer',
      );
    };
    expect(await writerUpdate(15616)).toMatchObject({ state: 'unedited', dismissed: true });
    // The user kept an older revision; the current default is newer, so it shows again.
    await writeFile(
      file,
      JSON.stringify({
        version: 1,
        dismissed: { writer: defaultInstructionHistory.writer[1].revision },
      }),
    );
    expect(await writerUpdate(15617)).toMatchObject({ state: 'unedited', dismissed: false });
    await writeFile(file, '{"broken"');
    expect(new InstructionUpdatePreferences(directory).dismissed()).toEqual({});
  });

  it('rejects decisions without a UI session, from agents and for retired roles', async () => {
    const { daemon, request, seedOld } = await fixture(15615);
    seedOld('scout', firstScout);
    daemon.service.capabilities.set('update-token', {
      roleId: 'scout',
      cardId: null,
      runId: 'update-fixture',
    });
    const body = JSON.stringify({ revision: latest('scout') });
    for (const path of ['adopt', 'dismiss']) {
      const url = `${daemon.url}/api/roles/scout/instructions-update/${path}`;
      const anonymous = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      });
      expect(anonymous.status).toBe(403);
      const agent = await fetch(url, {
        method: 'POST',
        headers: { authorization: 'Bearer update-token', 'content-type': 'application/json' },
        body,
      });
      expect(agent.status).toBe(403);
    }
    for (const action of ['adopt_default_instructions', 'dismiss_instruction_update', 'snapshot']) {
      const response = await fetch(`${daemon.url}/api/agent`, {
        method: 'POST',
        headers: { authorization: 'Bearer update-token', 'content-type': 'application/json' },
        body: JSON.stringify({ action, roleId: 'scout', revision: latest('scout') }),
      });
      expect(((await response.json()) as { error?: string }).error).toBeTruthy();
    }
    expect(daemon.service.board.get<Role>('role', 'scout').instructions).toBe(firstScout);

    await request('/roles/scout/retire', 'POST', {});
    const snapshot = (await request<Snapshot>('/snapshot')).result;
    expect(snapshot.instructionUpdates?.map((item) => item.roleId)).not.toContain('scout');
    const retired = await request<{ error: string }>(
      '/roles/scout/instructions-update/dismiss',
      'POST',
      { revision: latest('scout') },
    );
    expect(retired.result.error).toContain('retired');
  });
});
