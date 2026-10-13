import {
  currentEventVersion,
  decodeEvent,
  defaultCapabilities,
  type Card,
  type JobLinkImportResult,
  type Role,
  type Run,
} from '@pitchcrew/core';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, resources, setup } from './helpers/daemon.ts';
import {
  comeetFixtureToken,
  fixtureSources,
  jsonResponse,
  moreFixtureSources,
} from './helpers/job-boards.ts';
import { postingLinks, recordedPostings } from './helpers/job-links.ts';

const runId = 'agent-link-import';
const token = 'agent-link-import-token';
afterEach(async () => {
  for (const { daemon } of resources) daemon.service.controllers.delete(runId);
  await cleanup();
});

async function withImport() {
  const context = await setup(15631);
  const service = context.daemon.service;
  const boards = recordedPostings();
  service.jobSources.fetch = boards.fetcher;
  const setDiscovery = (discoverJobs: boolean, patch: Partial<Role> = {}) => {
    const role = service.board.get<Role>('role', 'scout');
    service.board.record(
      'role',
      {
        ...role,
        capabilities: { ...defaultCapabilities, discoverJobs },
        ...patch,
      },
      'user',
      'Fixture discovery setting',
    );
  };
  setDiscovery(true);
  const run: Run = {
    id: runId,
    roleId: 'scout',
    cardId: null,
    runtime: 'demo',
    status: 'running',
    mode: 'chat',
    threadId: 'scout',
    message: 'Fictional link import',
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  service.board.record('run', run, 'scout', 'Fixture');
  const controller = new AbortController();
  service.controllers.set(runId, controller);
  service.capabilities.set(token, { runId, roleId: 'scout', cardId: null });
  const importLink = (input: unknown) =>
    service.agentCall(token, 'import_job_link', { input }) as Promise<{
      result: JobLinkImportResult;
    }>;
  return { ...context, service, boards, setDiscovery, controller, run, importLink };
}

function added(result: JobLinkImportResult) {
  if (result.status !== 'added') throw new Error(`Unexpected import status: ${result.status}`);
  return result.lead;
}

describe('agent posting link imports', () => {
  it.each([
    'greenhouse',
    'ashby',
    'ashbySpaced',
    'lever',
    'comeet',
    'comeetEmbed',
    'workable',
  ] as const)(
    'adds a %s posting as a local lead through the agent HTTP gateway',
    async (provider) => {
      const { request, service, boards } = await withImport();
      if (provider === 'comeet') await service.jobSources.add(moreFixtureSources.comeet);
      const { response, result: body } = await request<{ result: JobLinkImportResult }>(
        '/agent',
        'POST',
        {
          action: 'import_job_link',
          input: { url: postingLinks[provider].link },
        },
        { authorization: `Bearer ${token}` },
      );
      expect(response.status).toBe(200);
      const lead = added(body.result);
      expect(lead.excerpt.length).toBeLessThanOrEqual(1500);
      expect(lead.excerpt).not.toContain('<');
      expect(boards.calls.map(({ url }) => url)).toEqual([postingLinks[provider].endpoint]);
      expect(boards.calls[0].init).toMatchObject({
        method: 'GET',
        redirect: 'error',
        credentials: 'omit',
      });
      const card = service.board.get<Card>('card', lead.id);
      expect(card).toMatchObject({
        state: 'lead',
        owner: null,
        packet: null,
        fit: null,
        sample: false,
        discovery: { sourceId: 'link' },
        tracking: { origin: 'pitchcrew', jobIdentifier: card.discovery!.jobId },
      });
      expect(card.company).toBe(lead.company);
      expect(card.title).toBe(lead.title);
      expect(card.description).toContain(lead.excerpt);
      if (provider === 'greenhouse') expect(card.sourceHtml).toContain('&lt;script&gt;');
      expect(lead).not.toHaveProperty('sourceHtml');
      const [event] = service.board.history(card.id);
      expect(event).toMatchObject({ actor: 'scout', version: currentEventVersion });
      expect(decodeEvent(JSON.stringify(event)).data).toMatchObject({ discovery: card.discovery });
      expect(service.board.list('approval')).toEqual([]);
      expect(service.board.list('run')).toHaveLength(1);
      expect(JSON.stringify([body, card, event])).not.toContain(comeetFixtureToken);
      expect(await service.jobSources.list()).toHaveLength(provider === 'comeet' ? 1 : 0);
      service.board.rebuild();
      expect(service.board.get<Card>('card', card.id)).toEqual(card);
    },
  );

  it('requires discovery permission and a live run before any fetch', async () => {
    const { service, boards, setDiscovery, importLink, controller, run } = await withImport();
    const input = { url: postingLinks.greenhouse.link };
    setDiscovery(false);
    await expect(importLink(input)).rejects.toThrow('disabled');
    setDiscovery(true, { enabled: false });
    await expect(importLink(input)).rejects.toThrow('paused');
    setDiscovery(true, { enabled: true });
    service.board.record('run', { ...run, status: 'completed' }, 'scout', 'Fixture end');
    await expect(importLink(input)).rejects.toThrow('ended');
    service.board.record('run', run, 'scout', 'Fixture restart');
    service.controllers.delete(runId);
    await expect(importLink(input)).rejects.toThrow('ended');
    service.controllers.set(runId, controller);
    controller.abort();
    await expect(importLink(input)).rejects.toThrow('expired');
    expect(boards.calls).toEqual([]);
    expect(service.board.list('card')).toEqual([]);
  });

  it('validates input and reports unsupported links and provider failures without creating cards', async () => {
    const { service, boards, importLink } = await withImport();
    for (const input of [
      undefined,
      {},
      { url: 42 },
      { url: 'x'.repeat(2001) },
      { url: postingLinks.greenhouse.link, endpoint: 'https://evil.example' },
    ])
      await expect(importLink(input)).rejects.toThrow();
    for (const url of [
      'https://127.0.0.1/jobs/42',
      'https://careers.example/jobs/42',
      'http://boards.greenhouse.io/northwindlabs/jobs/4010001001',
      'https://boards.greenhouse.io/northwindlabs/../jobs/4010001001',
    ])
      expect((await importLink({ url })).result.status).toBe('unrecognized');
    expect((await importLink({ url: postingLinks.comeet.link })).result).toMatchObject({
      status: 'failed',
      reason: expect.stringContaining('Comeet source'),
    });
    expect(boards.calls).toEqual([]);
    service.jobSources.fetch = recordedPostings({
      [postingLinks.greenhouse.endpoint]: () => jsonResponse({}, 404),
    }).fetcher;
    expect((await importLink({ url: postingLinks.greenhouse.link })).result).toMatchObject({
      status: 'failed',
      reason: expect.stringContaining('not found'),
    });
    expect(service.board.list('card')).toEqual([]);
  });

  it.each(['permission', 'paused', 'ended', 'token', 'cancelled', 'shutdown'] as const)(
    'does not commit after %s changes during a fetch',
    async (change) => {
      const { service, setDiscovery, controller, run, importLink } = await withImport();
      let release!: (response: Response) => void;
      let entered!: () => void;
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      service.jobSources.fetch = () => {
        entered();
        return new Promise<Response>((resolve) => {
          release = resolve;
        });
      };
      const pending = importLink({ url: postingLinks.greenhouse.link });
      const rejected = expect(pending).rejects.toThrow();
      await started;
      if (change === 'permission') setDiscovery(false);
      if (change === 'paused') setDiscovery(true, { enabled: false });
      if (change === 'ended')
        service.board.record('run', { ...run, status: 'completed' }, 'scout', 'Fixture end');
      if (change === 'token') service.capabilities.delete(token);
      if (change === 'cancelled') controller.abort();
      if (change === 'shutdown') service.jobSources.close();
      release(jsonResponse({ id: 4010001001, title: 'Engineer', company_name: 'Northwind' }));
      await rejected;
      expect(service.board.list('card')).toEqual([]);
    },
  );

  it('skips an existing card in any status and a later scan skips the imported lead', async () => {
    const { service, importLink } = await withImport();
    const input = { url: postingLinks.greenhouse.link };
    const lead = added((await importLink(input)).result);
    service.board.move(lead.id, 'withdrawn', 'user');
    const events = service.board.events();
    expect((await importLink(input)).result).toEqual({
      status: 'duplicate',
      duplicates: [{ id: lead.id, state: 'withdrawn' }],
    });
    expect(service.board.events()).toEqual(events);
    await service.jobSources.add({ ...fixtureSources.greenhouse, name: 'Different company label' });
    const scan = await service.jobSources.scan({ actor: 'user' });
    expect(scan.duplicate).toBe(1);
    expect(
      service.board.list<Card>('card').filter((card) => card.discovery?.jobId === '4010001001'),
    ).toHaveLength(1);
  });

  it.each(['url', 'identifier', 'company/title'] as const)(
    'skips a manually tracked duplicate matched by %s',
    async (match) => {
      const { service, importLink } = await withImport();
      const card = service.createCard({
        company: match === 'url' ? 'Alternate name' : 'Northwind Labs',
        title: match === 'company/title' ? 'Senior Frontend Engineer' : 'Alternate title',
        url:
          match === 'url'
            ? 'https://job-boards.greenhouse.io/northwindlabs/jobs/4010001001?utm_source=test#top'
            : '',
      });
      if (match === 'identifier')
        service.board.record(
          'card',
          {
            ...card,
            tracking: { origin: 'pitchcrew', jobIdentifier: '4010001001', gmailThreads: [] },
          },
          'user',
          'Fixture identifier',
        );
      const events = service.board.events();
      expect((await importLink({ url: postingLinks.greenhouse.link })).result).toEqual({
        status: 'duplicate',
        duplicates: [{ id: card.id, state: 'lead' }],
      });
      expect(service.board.events()).toEqual(events);
    },
  );

  it('creates just one lead when the same link is imported concurrently', async () => {
    const { service, importLink } = await withImport();
    const results = await Promise.all([
      importLink({ url: postingLinks.greenhouse.link }),
      importLink({ url: postingLinks.greenhouse.link }),
    ]);
    expect(results.map(({ result }) => result.status).sort()).toEqual(['added', 'duplicate']);
    expect(service.board.list('card')).toHaveLength(1);
  });

  it('ignores saved-source filters for an explicitly requested posting without changing sources', async () => {
    const { service, importLink } = await withImport();
    await service.jobSources.add({
      ...fixtureSources.greenhouse,
      enabled: false,
      filters: { titleExclude: ['engineer'] },
    });
    const before = await service.jobSources.list();
    expect((await importLink({ url: postingLinks.greenhouse.link })).result.status).toBe('added');
    expect(await service.jobSources.list()).toEqual(before);
  });

  it('redacts an echoed Comeet token in errors and returns only IDs for duplicate notices', async () => {
    const { service, importLink } = await withImport();
    service.jobSources.fetch = async (url) => {
      throw new Error(`Cannot read ${url}`);
    };
    const failed = (await importLink({ url: postingLinks.comeetEmbed.link })).result;
    expect(failed.status).toBe('failed');
    expect(JSON.stringify(failed)).not.toContain(comeetFixtureToken);
    service.jobSources.fetch = recordedPostings().fetcher;
    const card = service.createCard({
      company: `Wingtip ${comeetFixtureToken}`,
      title: comeetFixtureToken,
      url: postingLinks.comeet.link,
    });
    const duplicate = (await importLink({ url: postingLinks.comeetEmbed.link })).result;
    expect(duplicate).toEqual({
      status: 'duplicate',
      duplicates: [{ id: card.id, state: 'lead' }],
    });
    expect(JSON.stringify(duplicate)).not.toContain(comeetFixtureToken);
  });
});
