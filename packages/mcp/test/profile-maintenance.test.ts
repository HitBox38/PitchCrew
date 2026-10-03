import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  defaultCapabilities,
  type ProfileMaintenanceProposal,
  type ProfileSource,
  type ProfileSourcePreview,
  type Role,
  type Run,
  type Snapshot,
} from '@pitchcrew/core';
import { readProfile } from '@pitchcrew/packet';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { digest } from '../../orchestrator/src/profile-sources/helpers.ts';
import { createDaemon } from '../../orchestrator/src/server.ts';
import { cleanup, setup, resources } from '../../orchestrator/test/helpers/daemon.ts';

afterEach(cleanup);
const input = { provider: 'github', repository: 'fictional/profile', path: 'notes' };
const first = 'a'.repeat(40);
const second = 'b'.repeat(40);
type Fixture = Awaited<ReturnType<typeof setup>>;
function fixture(f: Fixture) {
  let revision = first;
  const documents = new Map([
    ['notes/background.md', 'Built the fictional scheduling tool.'],
    ['notes/project.md', 'Documented the fictional Atlas project.'],
  ]);
  const status = vi.spyOn(f.daemon.service.connectors, 'status').mockReturnValue([
    {
      id: 'github',
      account: 'fictional',
      connected: true,
      services: ['github'],
      configured: true,
      pending: false,
      error: '',
    },
  ]);
  const call = vi
    .spyOn(f.daemon.service.connectors, 'call')
    .mockImplementation(async (name, raw) => {
      if (name === 'github_get_revision') return { sha: revision };
      const args = raw as { path: string; ref: string };
      if (documents.has(args.path))
        return {
          text: documents.get(args.path),
          sha: digest(documents.get(args.path)!).slice(0, 40),
        };
      return { entries: [...documents.keys()].map((path) => ({ path, type: 'file' })) };
    });
  return {
    documents,
    call,
    status,
    changeRevision: () => {
      revision = second;
    },
  };
}
async function imported(f: Fixture) {
  const preview = (await f.request<ProfileSourcePreview>('/profile/sources/preview', 'POST', input))
    .result;
  await f.request('/profile/sources/import', 'POST', {
    token: preview.token,
    names: preview.files.map((file) => file.name),
  });
  const sources = (await f.request<ProfileSource[]>('/profile/sources')).result;
  await f.request(`/profile/sources/${sources[0]!.id}/watch`, 'PUT', { watching: true });
  return { preview, source: sources[0]! };
}
function active(f: Fixture, id = 'fixture-profile-run') {
  const role = f.daemon.service.board.get<Role>('role', 'scout');
  f.daemon.service.board.record(
    'role',
    { ...role, capabilities: { ...defaultCapabilities, maintainProfile: true, github: true } },
    'user',
    'Fixture permissions',
  );
  const run: Run = {
    id,
    roleId: 'scout',
    cardId: null,
    runtime: 'demo',
    status: 'running',
    message: 'Fixture',
    startedAt: '',
    finishedAt: null,
    mode: 'chat',
    threadId: 'scout',
  };
  f.daemon.service.board.record('run', run, 'scout', 'Fixture run');
  f.daemon.service.controllers.set(id, new AbortController());
  const token = `token-${id}`;
  f.daemon.service.capabilities.set(token, { runId: id, roleId: 'scout', cardId: null });
  return {
    token,
    end: () => {
      f.daemon.service.controllers.delete(id);
      f.daemon.service.capabilities.delete(token);
      f.daemon.service.board.record(
        'run',
        { ...run, status: 'completed' },
        'scout',
        'Fixture finished',
      );
    },
  };
}
async function agent<T>(f: Fixture, token: string, action: string, input: unknown = {}) {
  const response = await fetch(`${f.daemon.url}/api/agent`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ action, input }),
  });
  return { response, result: (await response.json()) as T };
}
function decision(proposal: ProfileMaintenanceProposal, extra: Record<string, unknown> = {}) {
  return {
    approved: true,
    snapshotDigest: proposal.snapshotDigest,
    names: proposal.documents.map((file) => file.name),
    verifiedFacts: true,
    ...extra,
  };
}

describe('profile maintenance', () => {
  it('stages exact source diffs, local conflicts and removals without writing, then applies the verified reviewed snapshot only when idle', async () => {
    const f = await setup(14601);
    const remote = fixture(f);
    const { preview, source } = await imported(f);
    const project = preview.files.find((file) => file.path.endsWith('project.md'))!;
    await f.daemon.service.saveProfile(project.name, 'Local verified edit');
    remote.documents.set(project.path, 'Remote replacement');
    remote.documents.delete('notes/background.md');
    const run = active(f);
    try {
      const result = await agent<{ proposal: ProfileMaintenanceProposal }>(
        f,
        run.token,
        'detect_profile_changes',
        { sourceId: source.id },
      );
      expect(result.response.status).toBe(200);
      const proposal = result.result.proposal;
      expect(proposal.documents[0]).toMatchObject({
        before: 'Local verified edit',
        content: 'Remote replacement',
        status: 'conflict',
      });
      expect(proposal.missing).toEqual(['notes/background.md']);
      expect(
        (await readProfile(f.directory)).find((file) => file.name === project.name)?.content,
      ).toBe('Local verified edit');
      expect(
        (await f.request(`/profile/proposals/${proposal.id}/decide`, 'POST', decision(proposal)))
          .response.status,
      ).toBe(400);
      expect(
        (
          await agent<{ proposal: ProfileMaintenanceProposal }>(
            f,
            run.token,
            'detect_profile_changes',
            { sourceId: source.id },
          )
        ).result.proposal.id,
      ).toBe(proposal.id);
      run.end();
      expect(
        (
          await f.request(
            `/profile/proposals/${proposal.id}/decide`,
            'POST',
            decision(proposal, { verifiedFacts: false }),
          )
        ).response.status,
      ).toBe(400);
      remote.documents.set(project.path, 'Later unseen remote content');
      const count = remote.call.mock.calls.length;
      const applied = await f.request<ProfileMaintenanceProposal>(
        `/profile/proposals/${proposal.id}/decide`,
        'POST',
        decision(proposal),
      );
      expect(applied.result.status).toBe('applied');
      expect(remote.call.mock.calls).toHaveLength(count);
      expect(await readProfile(f.directory)).toHaveLength(2);
      expect(
        (await readProfile(f.directory)).find((file) => file.name === project.name)?.content,
      ).toBe('Remote replacement');
      expect(
        (await f.request(`/profile/proposals/${proposal.id}/decide`, 'POST', decision(proposal)))
          .response.status,
      ).toBe(400);
      const events = f.daemon.service.board.events();
      expect(
        events
          .filter((event) => event.kind === 'profile_proposal')
          .every((event) => event.version === 9),
      ).toBe(true);
      f.daemon.service.board.rebuild();
      expect(f.daemon.service.board.get('profile_proposal', proposal.id)).toEqual(applied.result);
      expect((await f.request<Snapshot>('/snapshot')).result.profileProposals).toEqual([
        applied.result,
      ]);
    } finally {
      run.end();
    }
  });

  it('rejects stale notes, changed source settings, disconnected accounts and unauthorized agent access', async () => {
    const f = await setup(14602);
    const remote = fixture(f);
    const { source, preview } = await imported(f);
    remote.documents.set('notes/background.md', 'New supported fact');
    const run = active(f);
    let proposal: ProfileMaintenanceProposal;
    try {
      const role = f.daemon.service.board.get<Role>('role', 'scout');
      f.daemon.service.board.record(
        'role',
        { ...role, capabilities: { ...role.capabilities!, github: false } },
        'user',
        'Revoke read',
      );
      expect(
        (await agent(f, run.token, 'detect_profile_changes', { sourceId: source.id })).response
          .status,
      ).toBe(400);
      f.daemon.service.board.record('role', role, 'user', 'Restore fixture');
      proposal = (
        await agent<{ proposal: ProfileMaintenanceProposal }>(
          f,
          run.token,
          'detect_profile_changes',
          { sourceId: source.id },
        )
      ).result.proposal;
    } finally {
      run.end();
    }
    await f.daemon.service.saveProfile(preview.files[0]!.name, 'Edited since detection');
    expect(
      (
        await f.request<{ error: string }>(
          `/profile/proposals/${proposal!.id}/decide`,
          'POST',
          decision(proposal!),
        )
      ).result.error,
    ).toContain('notes changed');
    expect(
      f.daemon.service.board.get<ProfileMaintenanceProposal>('profile_proposal', proposal!.id)
        .status,
    ).toBe('pending');
    remote.status.mockReturnValue([]);
    expect(
      (
        await f.request<{ error: string }>(
          `/profile/proposals/${proposal!.id}/decide`,
          'POST',
          decision(proposal!),
        )
      ).result.error,
    ).toContain('Reconnect');
    await f.request(`/profile/sources/${source.id}/watch`, 'PUT', { watching: false });
    expect(
      (
        await f.request<{ error: string }>(
          `/profile/proposals/${proposal!.id}/decide`,
          'POST',
          decision(proposal!),
        )
      ).result.error,
    ).toContain('no longer watched');
    expect(
      (
        await fetch(`${f.daemon.url}/api/profile/proposals/${proposal!.id}/decide`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(decision(proposal!)),
        })
      ).status,
    ).toBe(403);
  });

  it('detects code-only GitHub project changes and keeps bounded pinned evidence and generated notes outside the factual profile until approval', async () => {
    const f = await setup(14603);
    const remote = fixture(f);
    remote.documents.clear();
    remote.documents.set('src/tool.ts', 'export const accessible = true;');
    const sources = (
      await f.request<ProfileSource[]>('/profile/sources/project', 'POST', {
        ...input,
        path: 'src',
      })
    ).result;
    expect(sources[0]).toMatchObject({
      mode: 'project',
      revision: first,
      watching: true,
      files: [],
    });
    remote.changeRevision();
    const run = active(f);
    let nextRun: ReturnType<typeof active> | undefined;
    try {
      const detected = (
        await agent<{ proposal: ProfileMaintenanceProposal }>(
          f,
          run.token,
          'detect_profile_changes',
          { sourceId: sources[0]!.id },
        )
      ).result.proposal;
      expect(detected.observation).toEqual({ previous: first, current: second });
      expect(detected.documents).toEqual([]);
      expect(
        (
          await agent(f, run.token, 'read_project_watch_file', {
            proposalId: detected.id,
            path: 'outside/secret.ts',
          })
        ).response.status,
      ).toBe(400);
      run.end();
      nextRun = active(f, 'fixture-followup-run');
      const restored = await agent<{ proposal: ProfileMaintenanceProposal }>(
        f,
        nextRun.token,
        'detect_profile_changes',
        { sourceId: sources[0]!.id },
      );
      expect(restored.result.proposal.id).toBe(detected.id);
      const updated = (
        await agent<{ proposal: ProfileMaintenanceProposal }>(
          f,
          nextRun.token,
          'propose_profile_note',
          {
            proposalId: detected.id,
            name: 'project-observation.md',
            content:
              'The fictional project exports an accessibility flag. Personal contribution needs verification.',
            paths: ['src/tool.ts'],
          },
        )
      ).result.proposal;
      expect(updated.generated).toBe(true);
      expect(updated.evidence?.[0]).toMatchObject({
        path: 'src/tool.ts',
        revision: second,
        content: 'export const accessible = true;',
      });
      expect(remote.call.mock.calls.at(-1)?.[1]).toMatchObject({ ref: second });
      expect(await readProfile(f.directory)).toEqual([]);
      expect(updated.snapshotDigest).not.toBe(detected.snapshotDigest);
      nextRun.end();
      expect(
        (
          await f.request<{ error: string }>(
            `/profile/proposals/${updated.id}/decide`,
            'POST',
            decision(detected),
          )
        ).result.error,
      ).toContain('proposal changed');
      expect(
        (
          await f.request<ProfileMaintenanceProposal>(
            `/profile/proposals/${updated.id}/decide`,
            'POST',
            decision(updated),
          )
        ).result.status,
      ).toBe('applied');
      expect((await readProfile(f.directory))[0]?.content).toContain(
        'Personal contribution needs verification',
      );
      expect((await f.request<ProfileSource[]>('/profile/sources')).result[0]?.revision).toBe(
        second,
      );
    } finally {
      nextRun?.end();
      run.end();
    }
  });

  it('rechecks watch and account permissions after a pending project read', async () => {
    const f = await setup(14606);
    const remote = fixture(f);
    const sources = (
      await f.request<ProfileSource[]>('/profile/sources/project', 'POST', {
        ...input,
        path: 'src',
      })
    ).result;
    remote.changeRevision();
    const run = active(f);
    try {
      const proposal = (
        await agent<{ proposal: ProfileMaintenanceProposal }>(
          f,
          run.token,
          'detect_profile_changes',
          { sourceId: sources[0]!.id },
        )
      ).result.proposal;
      let release: (value: Record<string, unknown>) => void = () => {};
      remote.call.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      );
      const read = agent<{ error: string }>(f, run.token, 'read_project_watch_file', {
        proposalId: proposal.id,
        path: 'src/tool.ts',
      });
      await vi.waitFor(() => expect(remote.call.mock.calls.at(-1)?.[0]).toBe('github_read_file'));
      expect(
        (await f.request(`/profile/sources/${sources[0]!.id}/watch`, 'PUT', { watching: false }))
          .response.status,
      ).toBe(200);
      release({ text: 'Pinned code' });
      expect((await read).result.error).toContain('watch changed');
      await f.request(`/profile/sources/${sources[0]!.id}/watch`, 'PUT', { watching: true });
      remote.call.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      );
      const note = agent<{ error: string }>(f, run.token, 'propose_profile_note', {
        proposalId: proposal.id,
        name: 'project.md',
        content: 'An unverified observation',
        paths: ['src/tool.ts'],
      });
      await vi.waitFor(() =>
        expect(
          remote.call.mock.calls.filter((call) => call[0] === 'github_read_file'),
        ).toHaveLength(2),
      );
      remote.status.mockReturnValue([]);
      release({ text: 'Pinned code' });
      expect((await note).result.error).toContain('disconnected');
      expect(
        f.daemon.service.board.get<ProfileMaintenanceProposal>('profile_proposal', proposal.id)
          .documents,
      ).toEqual([]);
      remote.status.mockReturnValue([
        {
          id: 'github',
          account: 'fictional',
          connected: true,
          services: ['github'],
          configured: true,
          pending: false,
          error: '',
        },
      ]);
      remote.call.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      );
      const removedRead = agent<{ error: string }>(f, run.token, 'read_project_watch_file', {
        proposalId: proposal.id,
        path: 'src/tool.ts',
      });
      await vi.waitFor(() =>
        expect(
          remote.call.mock.calls.filter((call) => call[0] === 'github_read_file'),
        ).toHaveLength(3),
      );
      expect(
        (await f.request(`/profile/sources/${sources[0]!.id}`, 'DELETE')).response.status,
      ).toBe(200);
      release({ text: 'Pinned code' });
      expect((await removedRead).result.error).toContain('watch changed');
    } finally {
      run.end();
    }
  });

  it('recovers an interrupted approved snapshot after replay without refetching or changing its selection', async () => {
    const f = await setup(14604);
    const remote = fixture(f);
    const { source } = await imported(f);
    remote.documents.set('notes/background.md', 'Approved new background');
    remote.documents.set('notes/project.md', 'Approved new project');
    const run = active(f);
    let proposal: ProfileMaintenanceProposal;
    try {
      proposal = (
        await agent<{ proposal: ProfileMaintenanceProposal }>(
          f,
          run.token,
          'detect_profile_changes',
          { sourceId: source.id },
        )
      ).result.proposal;
    } finally {
      run.end();
    }
    const applying: ProfileMaintenanceProposal = {
      ...f.daemon.service.board.get<ProfileMaintenanceProposal>('profile_proposal', proposal!.id),
      status: 'applying',
      selected: proposal!.documents.map((file) => file.name),
      verifiedFacts: true,
    };
    f.daemon.service.board.record(
      'profile_proposal',
      applying,
      'user',
      'Interrupted fixture approval',
    );
    await writeFile(
      join(f.directory, 'profile', applying.documents[0]!.name),
      applying.documents[0]!.content,
    );
    f.daemon.service.board.rebuild();
    expect(
      (
        await f.request(
          `/profile/proposals/${applying.id}/decide`,
          'POST',
          decision(applying, { names: [] }),
        )
      ).response.status,
    ).toBe(400);
    await f.daemon.service.profileSources.commitMaintenance(applying, applying.selected!, true);
    await expect(
      f.daemon.service.sendChat('scout', { content: 'Fixture question' }),
    ).rejects.toThrow('approved profile update');
    await expect(f.daemon.service.saveProfile('other.md', 'Another note')).rejects.toThrow(
      'approved profile update',
    );
    const card = f.daemon.service.createCard({
      company: 'Fictional',
      title: 'Engineer',
      url: 'https://example.com/job',
      jobPost: 'Fictional role',
    });
    await expect(f.daemon.service.startRun(card.id, 'scout')).rejects.toThrow(
      'approved profile update',
    );
    const routine = f.daemon.service.saveRoutine({
      name: 'Fixture scheduled scan',
      roleId: 'scout',
      content: 'Review fictional profile sources.',
      startAt: '2030-01-01T09:00:00Z',
      timezone: 'UTC',
    });
    await f.daemon.service.tickRoutines(new Date('2030-01-01T09:00:00Z'));
    expect(f.daemon.service.routines().find((item) => item.id === routine.id)?.runCount).toBe(0);
    await f.daemon.close();
    const restarted = await createDaemon({
      directory: f.directory,
      port: 14604,
      seedSkills: false,
    });
    resources.find((item) => item.directory === f.directory)!.daemon = restarted;
    f.daemon = restarted;
    const freshRemote = fixture(f);
    expect(
      (await f.daemon.service.decideProfileProposal(applying.id, decision(applying))).status,
    ).toBe('applied');
    expect(freshRemote.call).not.toHaveBeenCalled();
    await f.daemon.service.tickRoutines(new Date('2030-01-01T09:00:00Z'));
    expect(f.daemon.service.routines().find((item) => item.id === routine.id)?.runCount).toBe(1);
    await vi.waitFor(
      () =>
        expect(
          f.daemon.service.board.list<Run>('run').some((run) => run.status === 'running'),
        ).toBe(false),
      { timeout: 3000 },
    );

    expect(
      (await readProfile(f.directory)).every((file) => file.content.startsWith('Approved new')),
    ).toBe(true);
  });

  it('reports an emptied source without deleting notes or repeatedly proposing acknowledged removals', async () => {
    const f = await setup(14607);
    const remote = fixture(f);
    const { source } = await imported(f);
    remote.documents.clear();
    const run = active(f);
    let proposal: ProfileMaintenanceProposal;
    try {
      proposal = (
        await agent<{ proposal: ProfileMaintenanceProposal }>(
          f,
          run.token,
          'detect_profile_changes',
          { sourceId: source.id },
        )
      ).result.proposal;
    } finally {
      run.end();
    }
    expect(proposal!.missing).toHaveLength(2);
    expect(proposal!.documents).toEqual([]);
    await f.daemon.service.decideProfileProposal(proposal!.id, decision(proposal!));
    expect(await readProfile(f.directory)).toHaveLength(2);
    const next = active(f, 'fixture-second-scan');
    try {
      expect(
        (
          await agent<{ detected: boolean }>(f, next.token, 'detect_profile_changes', {
            sourceId: source.id,
          })
        ).result.detected,
      ).toBe(false);
    } finally {
      next.end();
    }
  });

  it('dispatches maintenance through the actual MCP stdio server and retains disabled-capability boundaries', async () => {
    const f = await setup(14605);
    const remote = fixture(f);
    const { source } = await imported(f);
    remote.documents.set('notes/background.md', 'New fictional fact');
    const run = active(f);
    const client = new Client({ name: 'profile-maintenance-test', version: '1.0.0' });
    try {
      await client.connect(
        new StdioClientTransport({
          command: process.execPath,
          args: [
            '--import',
            import.meta.resolve('tsx'),
            fileURLToPath(new URL('../src/cli.ts', import.meta.url)),
          ],
          env: {
            ...Object.fromEntries(
              Object.entries(process.env).filter(
                (entry): entry is [string, string] => entry[1] !== undefined,
              ),
            ),
            PITCHCREW_DAEMON_URL: f.daemon.url,
            PITCHCREW_RUN_TOKEN: run.token,
          },
          stderr: 'pipe',
        }),
      );
      expect(
        (await client.callTool({ name: 'pitchcrew_list_watched_profile_sources', arguments: {} }))
          .structuredContent,
      ).toMatchObject({ sources: [{ id: source.id }] });
      const result = await client.callTool({
        name: 'pitchcrew_detect_profile_changes',
        arguments: { sourceId: source.id },
      });
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({ proposal: { status: 'pending' } });
      const role = f.daemon.service.board.get<Role>('role', 'scout');
      f.daemon.service.board.record(
        'role',
        { ...role, capabilities: { ...role.capabilities!, maintainProfile: false } },
        'user',
        'Disabled fixture',
      );
      expect(
        (await client.callTool({ name: 'pitchcrew_list_watched_profile_sources', arguments: {} }))
          .isError,
      ).toBe(true);
    } finally {
      await client.close();
      run.end();
    }
  }, 30000);
});
