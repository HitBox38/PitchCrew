import {
  currentEventVersion,
  decodeEvent,
  defaultCapabilities,
  maxJobSources,
  type Card,
  type JobScanSummary,
  type JobSource,
  type JobSourcePreview,
  type Role,
  type Run,
} from '@pitchcrew/core';
import { recordDiscoveredLeads } from '@pitchcrew/board';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, resources, setup } from './helpers/daemon.ts';
import { fixtureSources, fixtureUrls, jsonResponse, recordedBoards } from './helpers/job-boards.ts';

const fakeRuns: string[] = [];
afterEach(async () => {
  for (const { daemon } of resources)
    for (const id of fakeRuns) daemon.service.controllers.delete(id);
  fakeRuns.length = 0;
  await cleanup();
});
type Request = Awaited<ReturnType<typeof setup>>['request'];

async function withSources(port: number) {
  const context = await setup(port);
  const boards = recordedBoards();
  context.daemon.service.jobSources.fetch = boards.fetcher;
  const added: JobSource[] = [];
  for (const source of Object.values(fixtureSources)) {
    const { response, result } = await context.request<JobSource>('/job-sources', 'POST', source);
    expect(response.status).toBe(201);
    added.push(result);
  }
  return { ...context, boards, added };
}
const scan = (request: Request, body: unknown = {}) =>
  request<JobScanSummary>('/job-sources/scan', 'POST', body);
const discovered = (cards: Card[]) => cards.filter((card) => card.discovery);
function enableDiscovery(daemon: Awaited<ReturnType<typeof setup>>['daemon'], on: boolean) {
  const scout = daemon.service.board.get<Role>('role', 'scout');
  daemon.service.board.record(
    'role',
    { ...scout, capabilities: { ...defaultCapabilities, ...scout.capabilities, discoverJobs: on } },
    'user',
    'Fixture discovery setting',
  );
}
function fakeRun(daemon: Awaited<ReturnType<typeof setup>>['daemon'], id: string) {
  daemon.service.board.record(
    'run',
    {
      id,
      roleId: 'scout',
      cardId: null,
      runtime: 'demo',
      status: 'running',
      mode: 'chat',
      threadId: 'scout',
      message: 'Fictional discovery run',
      startedAt: new Date().toISOString(),
      finishedAt: null,
    } satisfies Run,
    'scout',
    'Fixture',
  );
  daemon.service.controllers.set(id, new AbortController());
  fakeRuns.push(id);
  daemon.service.capabilities.set(`${id}-token`, { runId: id, roleId: 'scout', cardId: null });
  return `${id}-token`;
}

describe('job sources over HTTP', () => {
  it('keeps source management and scans behind the local UI session', async () => {
    const { daemon, request, cookie } = await setup(15461);
    const token = fakeRun(daemon, 'http-boundary');
    enableDiscovery(daemon, true);
    const attempts: Record<string, string>[] = [
      {},
      { cookie },
      { 'x-pitchcrew-client': 'ui' },
      { authorization: `Bearer ${token}`, 'x-pitchcrew-client': 'ui' },
      { cookie, 'x-pitchcrew-client': 'ui', origin: 'https://evil.example' },
    ];
    for (const headers of attempts)
      for (const [path, method] of [
        ['/job-sources', 'GET'],
        ['/job-sources', 'POST'],
        ['/job-sources/scan', 'POST'],
        ['/job-sources/preview', 'POST'],
      ] as const) {
        const response = await fetch(`${daemon.url}/api${path}`, {
          method,
          headers: { 'content-type': 'application/json', ...headers },
          ...(method === 'POST' ? { body: JSON.stringify(fixtureSources.lever) } : {}),
        });
        expect(response.status, `${method} ${path}`).toBe(403);
      }
    expect((await request<JobSource[]>('/job-sources')).result).toEqual([]);
    // Agents have no source-management action, even with discovery enabled.
    for (const action of ['add_job_source', 'save_job_source', 'delete_job_source'])
      await expect(daemon.service.agentCall(token, action, { input: {} })).rejects.toThrow(
        'not allowed',
      );
  });

  it.each(['pause', 'remove', 'edit'] as const)(
    'does not create stale leads when a source is changed during a scan: %s',
    async (change) => {
      const { daemon } = await setup(15480);
      const manager = daemon.service.jobSources;
      const source = await manager.add(fixtureSources.lever);
      let release!: (response: Response) => void;
      let entered!: () => void;
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      manager.fetch = () => {
        entered();
        return new Promise<Response>((resolve) => {
          release = resolve;
        });
      };
      const pending = manager.scan({ actor: 'user' });
      await started;
      if (change === 'remove') await manager.remove(source.id);
      else
        await manager.update(source.id, {
          ...fixtureSources.lever,
          ...(change === 'pause' ? { enabled: false } : { slug: 'new-board' }),
        });
      release(jsonResponse([{ id: 'one', text: 'Engineer' }]));
      const summary = await pending;
      expect(summary.new).toBe(0);
      expect(summary.sources[0].status).toBe('skipped');
      expect(discovered(daemon.service.board.list<Card>('card'))).toEqual([]);
      expect((await manager.list())[0]?.lastScan).toBeUndefined();
    },
  );

  it('rechecks discovery permission before saving asynchronously fetched jobs', async () => {
    const { daemon } = await setup(15481);
    const manager = daemon.service.jobSources;
    await manager.add(fixtureSources.lever);
    enableDiscovery(daemon, true);
    const token = fakeRun(daemon, 'revoked-discovery');
    let release!: (response: Response) => void;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    manager.fetch = () => {
      entered();
      return new Promise<Response>((resolve) => {
        release = resolve;
      });
    };
    const pending = daemon.service.agentCall(token, 'scan_job_sources', {});
    await started;
    enableDiscovery(daemon, false);
    release(jsonResponse([{ id: 'one', text: 'Engineer' }]));
    await expect(pending).rejects.toThrow('disabled');
    expect(discovered(daemon.service.board.list<Card>('card'))).toEqual([]);
  });

  it('adds, edits, pauses and removes sources with validation and caps', async () => {
    const { request, added, directory } = await withSources(15462);
    expect(added.map((source) => source.filters)).toEqual(
      added.map(() => ({
        titleInclude: [],
        titleExclude: [],
        locationInclude: [],
        remoteOnly: false,
      })),
    );
    const invalid = await request<{ error: string }>('/job-sources', 'POST', {
      ...fixtureSources.lever,
      slug: '../v1/admin',
    });
    expect(invalid.response.status).toBe(400);
    const duplicate = await request<{ error: string }>('/job-sources', 'POST', {
      ...fixtureSources.lever,
      slug: 'CONTOSO-ROBOTICS',
    });
    expect(duplicate.result.error).toContain('already a source');
    const extra = await request('/job-sources', 'POST', {
      ...fixtureSources.lever,
      slug: 'other',
      url: 'https://evil.example',
    });
    expect(extra.response.status).toBe(400);
    const edited = await request<JobSource>(`/job-sources/${added[0].id}`, 'PUT', {
      ...fixtureSources.greenhouse,
      enabled: false,
      filters: { titleInclude: ['engineer', 'engineer'], remoteOnly: true },
    });
    expect(edited.result).toMatchObject({
      id: added[0].id,
      enabled: false,
      filters: { titleInclude: ['engineer'], titleExclude: [], remoteOnly: true },
    });
    expect((await request(`/job-sources/not-a-uuid`, 'DELETE')).response.status).toBe(400);
    expect((await request(`/job-sources/${added[2].id}`, 'DELETE')).response.status).toBe(200);
    for (let index = 2; index < maxJobSources; index++)
      expect(
        (
          await request('/job-sources', 'POST', {
            provider: 'lever',
            slug: `fictional-${index}`,
            name: `Fictional ${index}`,
          })
        ).response.status,
      ).toBe(201);
    const over = await request<{ error: string }>('/job-sources', 'POST', {
      provider: 'lever',
      slug: 'one-too-many',
      name: 'One too many',
    });
    expect(over.result.error).toContain(`at most ${maxJobSources}`);
    expect(directory).toBeTruthy();
  });

  it('previews matching postings without creating cards', async () => {
    const { request, boards } = await withSources(15463);
    const { result } = await request<JobSourcePreview>('/job-sources/preview', 'POST', {
      ...fixtureSources.greenhouse,
      filters: { titleInclude: ['engineer'], titleExclude: ['intern'] },
    });
    expect(result).toMatchObject({ fetched: 4, matching: 2, filtered: 2, duplicate: 0 });
    expect(result.postings.map((posting) => posting.title)).toEqual([
      'Senior Frontend Engineer',
      'Engineering Manager, Platform',
    ]);
    expect((await request<{ cards: Card[] }>('/snapshot')).result.cards).toHaveLength(0);
    expect(boards.calls.map((call) => call.url)).toEqual([fixtureUrls.greenhouse]);
  });

  it('scans into leads with provenance and never re-adds known or withdrawn jobs', async () => {
    const { daemon, request, added, boards } = await withSources(15464);
    // A manually added card with the same canonical URL is a duplicate.
    await request('/cards', 'POST', {
      company: 'Fabrikam',
      title: 'Product Designer',
      url: 'https://jobs.ashbyhq.com/fabrikam/6f1c2b3a-1111-4c3d-9e8f-0a1b2c3d4e5f?utm_source=board',
    });
    await request(`/job-sources/${added[0].id}`, 'PUT', {
      ...fixtureSources.greenhouse,
      filters: { titleExclude: ['intern'] },
    });
    const first = await scan(request);
    expect(first.response.status).toBe(200);
    expect(first.result).toMatchObject({ new: 6, duplicate: 1, filtered: 1, failedSources: 0 });
    expect(new Set(boards.calls.map((call) => call.url))).toEqual(
      new Set(Object.values(fixtureUrls)),
    );
    const cards = discovered(daemon.service.board.list<Card>('card'));
    expect(cards).toHaveLength(6);
    const lead = cards.find((card) => card.discovery?.jobId === '4010001001')!;
    expect(lead).toMatchObject({
      state: 'lead',
      company: 'Northwind Labs',
      title: 'Senior Frontend Engineer',
      location: 'Remote - United States',
      url: 'https://job-boards.greenhouse.io/northwindlabs/jobs/4010001001',
      tracking: { origin: 'pitchcrew', jobIdentifier: '4010001001', gmailThreads: [] },
      discovery: {
        provider: 'greenhouse',
        sourceId: added[0].id,
        sourceName: 'Northwind Labs',
        slug: 'northwindlabs',
        postedAt: '2026-09-20T13:00:00.000Z',
      },
    });
    expect(lead.description).not.toContain('<');
    expect(first.result.newLeads.map((item) => item.id).sort()).toEqual(
      cards.map((card) => card.id).sort(),
    );
    expect(daemon.service.board.history(lead.id)[0]).toMatchObject({
      actor: 'user',
      version: currentEventVersion,
    });
    await request(`/cards/${lead.id}/move`, 'POST', { state: 'withdrawn' });
    const again = await scan(request);
    expect(again.result).toMatchObject({ new: 0, duplicate: 7, filtered: 1 });
    expect(discovered(daemon.service.board.list<Card>('card'))).toHaveLength(6);
    const sources = (await request<JobSource[]>('/job-sources')).result;
    expect(sources[0].lastScan).toMatchObject({ status: 'ok', new: 0, duplicate: 3, filtered: 1 });
  });

  it('reports failed sources without stopping the others', async () => {
    const { daemon, request } = await withSources(15465);
    daemon.service.jobSources.fetch = recordedBoards({
      [fixtureUrls.lever]: () => jsonResponse({ message: 'Document not found' }, 404),
      [fixtureUrls.ashby]: () =>
        new Response('<html>', { headers: { 'content-type': 'text/html' } }),
    }).fetcher;
    const { result } = await scan(request);
    expect(result).toMatchObject({ new: 4, failedSources: 2 });
    expect(result.sources.filter((source) => source.status === 'failed')).toEqual([
      expect.objectContaining({ name: 'Fabrikam', error: 'The job board did not return JSON.' }),
      expect.objectContaining({
        name: 'Contoso Robotics',
        error: expect.stringContaining('not found'),
      }),
    ]);
    const sources = (await request<JobSource[]>('/job-sources')).result;
    expect(sources[2].lastScan).toMatchObject({ status: 'failed' });
  });
});

describe('agent scans', () => {
  it('requires discoverJobs and accepts only saved source IDs', async () => {
    const { daemon, added } = await withSources(15466);
    const token = fakeRun(daemon, 'agent-scan');
    expect(await daemon.service.agentCall(token, 'job_discovery_access', {})).toEqual({
      discoverJobs: false,
    });
    await expect(daemon.service.agentCall(token, 'scan_job_sources', {})).rejects.toThrow(
      'disabled',
    );
    await expect(daemon.service.agentCall(token, 'job_sources', {})).rejects.toThrow('disabled');
    enableDiscovery(daemon, true);
    expect(await daemon.service.agentCall(token, 'job_discovery_access', {})).toEqual({
      discoverJobs: true,
    });
    const listed = await daemon.service.agentCall(token, 'job_sources', {});
    expect(listed.sources).toHaveLength(3);
    expect(JSON.stringify(listed)).not.toContain('slug');
    for (const input of [
      { url: 'https://evil.example/jobs' },
      { sourceIds: ['not-a-uuid'] },
      { provider: 'lever', slug: 'other' },
    ])
      await expect(
        daemon.service.agentCall(token, 'scan_job_sources', { input }),
      ).rejects.toThrow();
    await expect(
      daemon.service.agentCall(token, 'scan_job_sources', {
        input: { sourceIds: ['00000000-0000-4000-8000-000000000000'] },
      }),
    ).rejects.toThrow('not found');
    const { summary } = (await daemon.service.agentCall(token, 'scan_job_sources', {
      input: { sourceIds: [added[2].id] },
    })) as { summary: JobScanSummary };
    expect(summary).toMatchObject({
      new: 2,
      sources: [{ name: 'Contoso Robotics', status: 'ok' }],
    });
    const card = daemon.service.board.get<Card>('card', summary.newLeads[0].id);
    expect(daemon.service.board.history(card.id)[0].actor).toBe('scout');
    // Recently scanned sources are skipped for agents.
    const repeat = (await daemon.service.agentCall(token, 'scan_job_sources', {})) as {
      summary: JobScanSummary;
    };
    expect(repeat.summary.sources.find((item) => item.sourceId === added[2].id)).toMatchObject({
      status: 'skipped',
    });
    expect(repeat.summary.new).toBe(6);
    enableDiscovery(daemon, false);
    await expect(daemon.service.agentCall(token, 'scan_job_sources', {})).rejects.toThrow(
      'disabled',
    );
  });

  it('defaults discoverJobs off for every seeded role', async () => {
    const { daemon } = await setup(15467);
    for (const role of daemon.service.board.list<Role>('role'))
      expect({ ...defaultCapabilities, ...role.capabilities }.discoverJobs, role.id).toBe(false);
    expect(daemon.service.board.get<Role>('role', 'scout').instructions).toContain(
      'pitchcrew_scan_job_sources',
    );
  });

  it('lets a scheduled Scout routine scan saved sources', async () => {
    const { daemon, request } = await withSources(15468);
    enableDiscovery(daemon, true);
    const routine = await request<{ id: string }>('/routines', 'POST', {
      name: 'Morning job scan',
      roleId: 'scout',
      content: 'Scan my job sources and assess new leads.',
      startAt: '2030-01-01T09:00:00Z',
      timezone: 'UTC',
      enabled: true,
    });
    expect(routine.response.status).toBe(201);
    await daemon.service.tickRoutines(new Date('2030-01-01T09:00:01Z'));
    const run = daemon.service.board
      .list<Run>('run')
      .find((item) => item.routineId === routine.result.id && item.status === 'running');
    expect(run).toBeTruthy();
    const token = [...daemon.service.capabilities.entries()].find(
      ([, value]) => value.runId === run!.id,
    )![0];
    const response = await request<{ summary: JobScanSummary }>(
      '/agent',
      'POST',
      { action: 'scan_job_sources', input: {} },
      { authorization: `Bearer ${token}` },
    );
    expect(response.response.status).toBe(200);
    expect(response.result.summary.new).toBe(8);
    daemon.service.cancelRun(run!.id);
  });
});

describe('event version 10', () => {
  it('replays discovered cards and keeps older versions decodable', async () => {
    const { daemon, request } = await withSources(15469);
    await scan(request);
    const before = daemon.service.board.list<Card>('card');
    const legacy = daemon.service.board.events(1)[0];
    daemon.service.board.db.prepare('INSERT INTO events(json) VALUES (?)').run(
      JSON.stringify({
        ...legacy,
        id: 0,
        version: 9,
        entityId: 'legacy-card',
        data: { ...before[0], id: 'legacy-card', discovery: undefined },
      }),
    );
    daemon.service.board.rebuild();
    const after = daemon.service.board.list<Card>('card');
    expect(after.filter((card) => card.id !== 'legacy-card')).toEqual(before);
    expect(after.find((card) => card.id === 'legacy-card')?.discovery).toBeUndefined();
    expect(decodeEvent(JSON.stringify({ ...legacy, version: 10 })).version).toBe(10);
    expect(() => decodeEvent(JSON.stringify({ ...legacy, version: 11 }))).toThrow('Unsupported');
  });

  it('caps new leads per scan and leaves the rest for later', async () => {
    const { daemon } = await setup(15470);
    const source = { id: 's', name: 'Fictional Many', provider: 'lever' as const, slug: 'many' };
    const items = Array.from({ length: 4 }, (_, index) => ({
      source,
      posting: {
        provider: 'lever' as const,
        jobId: `job-${index}`,
        title: `Role ${index}`,
        location: '',
        remote: false,
        url: `https://jobs.lever.co/many/job-${index}`,
        description: '',
        salary: '',
        postedAt: null,
      },
    }));
    const first = recordDiscoveredLeads(daemon.service.board, [...items, items[0]], 'user', 2);
    expect([first.created.length, first.duplicate.length, first.deferred.length]).toEqual([
      2, 1, 2,
    ]);
    const second = recordDiscoveredLeads(daemon.service.board, items, 'user', 2);
    expect([second.created.length, second.duplicate.length]).toEqual([2, 2]);
  });
});
