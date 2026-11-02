import {
  defaultCapabilities,
  type BrowserAction,
  type BrowserSnapshot,
  type Card,
  type ComputerApproval,
  type JobLinkImportResult,
  type Role,
  type Run,
} from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, resources, setup } from './helpers/daemon.ts';
import {
  postingParagraphs,
  rawPostingExtraction,
  readablePosting,
} from './fixtures/job-posting-extraction.ts';
import posting from './fixtures/job-boards/browser-posting.json';

const runId = 'browser-job-import';
const token = 'browser-job-import-token';
const url = 'https://8.8.8.8/jobs/engineer';
const details = {
  company: 'Northwind Labs',
  title: 'Engineer',
  description: 'Build reliable applications.',
};

const fixture = async () => {
  let page: BrowserSnapshot = {
    url: 'about:blank',
    title: '',
    text: '',
    screenshot: '',
    digest: 'blank',
  };
  const driver = {
    snapshot: vi.fn(async () => page),
    perform: vi.fn(async (action: BrowserAction) => {
      if (action.kind === 'navigate')
        page = {
          ...page,
          url: action.url,
          title: details.title,
          text: `${details.company}\n${details.title}\n${details.description}`,
          digest: 'posting',
        };
    }),
    close: vi.fn(async () => {}),
  };
  const { daemon, request } = await setup(19567, false, { browserLaunch: async () => driver });
  const service = daemon.service;
  const role = service.board.get<Role>('role', 'scout');
  const setPermissions = (patch: Partial<Role['capabilities']>) =>
    service.board.record(
      'role',
      {
        ...service.board.get<Role>('role', role.id),
        capabilities: { ...defaultCapabilities, discoverJobs: true, computerUse: true, ...patch },
      },
      'user',
      'Fixture permissions',
    );
  setPermissions({});
  const run: Run = {
    id: runId,
    roleId: role.id,
    cardId: null,
    runtime: 'demo',
    status: 'running',
    mode: 'chat',
    threadId: 'scout',
    message: 'Add this job',
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  service.board.record('run', run, 'user', 'Fixture browser import');
  const controller = new AbortController();
  service.controllers.set(runId, controller);
  service.capabilities.set(token, { runId, roleId: role.id, cardId: null });
  service.jobSources.readPage = vi.fn(async () => {
    throw new Error('JavaScript required');
  });
  const call = (action: string, input: Record<string, unknown> = {}) =>
    service.agentCall(token, action, input);
  const importLink = (input: Record<string, unknown> = {}) =>
    call('import_job_link', {
      input: { url, browserDigest: 'posting', details, ...input },
    }) as Promise<{ result: JobLinkImportResult }>;
  const navigate = async () => {
    await call('computer_inspect');
    const { approval } = (await call('computer_request', {
      input: { kind: 'navigate', url },
      reason: 'Read the job posting you sent me',
    })) as { approval: ComputerApproval };
    expect(approval.status).toBe('pending');
    expect(driver.perform).not.toHaveBeenCalled();
    await request(`/computer-approvals/${approval.id}/decide`, 'POST', { approved: true });
    await call('computer_execute', { approvalId: approval.id });
    return (await call('computer_inspect')).page;
  };
  return {
    service,
    request,
    call,
    importLink,
    navigate,
    driver,
    controller,
    setPermissions,
    run,
    changePage: (patch: Partial<BrowserSnapshot>) => {
      page = { ...page, ...patch };
    },
  };
};

afterEach(async () => {
  for (const { daemon } of resources) daemon.service.controllers.delete(runId);
  await cleanup();
});

it('reads a JavaScript posting in the chat browser and saves it without asking for pasted text', async () => {
  const { service, navigate, importLink } = await fixture();
  expect(await navigate()).toMatchObject({
    url,
    text: expect.stringContaining(details.description),
  });
  expect((await importLink()).result).toMatchObject({
    status: 'added',
    lead: { company: details.company, title: details.title, excerpt: details.description },
  });
  const [card] = service.board.list<Card>('card');
  expect(card).toMatchObject({ ...details, url, state: 'lead', packet: null, fit: null });
  expect(service.board.history(card.id)[0].actor).toBe('scout');
  expect(service.jobSources.readPage).not.toHaveBeenCalled();
  expect((await importLink()).result.status).toBe('duplicate');
  expect(service.board.list<Card>('card')).toHaveLength(1);
  service.board.rebuild();
  expect(service.board.get<Card>('card', card.id)).toEqual(card);
});

it.each(['digest', 'url', 'empty', 'dialog'] as const)(
  'rejects %s browser evidence without creating a job',
  async (kind) => {
    const { service, navigate, importLink, changePage } = await fixture();
    await navigate();
    if (kind === 'digest') changePage({ digest: 'changed' });
    if (kind === 'url') changePage({ url: 'https://8.8.8.8/other-job' });
    if (kind === 'empty') changePage({ text: '' });
    if (kind === 'dialog') changePage({ dialog: { type: 'alert', message: 'Blocked' } });
    await expect(importLink()).rejects.toThrow();
    expect(service.board.list<Card>('card')).toEqual([]);
  },
);

it.each(['discoverJobs', 'computerUse'] as const)(
  'requires %s before reading browser evidence',
  async (permission) => {
    const { service, navigate, importLink, driver, setPermissions } = await fixture();
    await navigate();
    setPermissions({ [permission]: false });
    driver.snapshot.mockClear();
    await expect(importLink()).rejects.toThrow('disabled');
    expect(driver.snapshot).not.toHaveBeenCalled();
    expect(service.board.list<Card>('card')).toEqual([]);
  },
);

it('returns browser text for extraction without saving guessed fields', async () => {
  const { service, navigate, importLink } = await fixture();
  await navigate();
  expect((await importLink({ details: undefined })).result).toMatchObject({
    status: 'needs_details',
    url,
    text: expect.stringContaining(details.description),
  });
  expect(service.board.list<Card>('card')).toEqual([]);
});

it('saves readable full browser postings and preserves the original inspection evidence', async () => {
  const { service, navigate, importLink, changePage, driver } = await fixture();
  await navigate();
  changePage({ text: posting.raw });
  const original = await driver.snapshot();
  expect(
    (await importLink({ details: { ...details, description: posting.raw } })).result.status,
  ).toBe('added');
  const [card] = service.board.list<Card>('card');
  expect(card.description).toBe(posting.readable);
  expect(original.text).toBe(posting.raw);
  expect((await driver.snapshot()).text).toBe(posting.raw);
  expect((service.board.history(card.id)[0].data as Card).description).toBe(posting.readable);
  service.board.rebuild();
  expect(service.board.get<Card>('card', card.id).description).toBe(posting.readable);
  expect(
    (await importLink({ cardId: card.id, details: { ...details, description: posting.raw } }))
      .result.status,
  ).toBe('updated');
  expect(service.board.get<Card>('card', card.id).description).toBe(posting.readable);
});

it('does not create or refresh a job from unsupported browser extraction syntax', async () => {
  const { service, navigate, importLink, changePage } = await fixture();
  await navigate();
  const raw = '- heading "About us" [level=2]\n- button "Original text"';
  changePage({ text: raw });
  const input = { details: { ...details, description: raw } };
  await expect(importLink(input)).rejects.toThrow('could not be converted safely');
  expect(service.board.list<Card>('card')).toHaveLength(0);
  await importLink();
  const [card] = service.board.list<Card>('card');
  await expect(importLink({ ...input, cardId: card.id })).rejects.toThrow(
    'could not be converted safely',
  );
  expect(service.board.get<Card>('card', card.id)).toEqual(card);
});

it('rejects oversized browser descriptions instead of silently clipping the posting', async () => {
  const { service, navigate, importLink, changePage } = await fixture();
  await navigate();
  const text = 'x'.repeat(20001);
  changePage({ text });
  expect((await importLink({ details: undefined })).result).toMatchObject({
    status: 'needs_details',
    text,
  });
  await expect(importLink({ details: { ...details, description: text } })).rejects.toThrow();
  expect(service.board.list<Card>('card')).toHaveLength(0);
});

it('rejects structural metadata left outside the supported browser conversion grammar', async () => {
  const { service, navigate, importLink, changePage } = await fixture();
  await navigate();
  const raw = 'heading "About us" [level=2]\nparagraph: Build UI.';
  changePage({ text: raw });
  await expect(importLink({ details: { ...details, description: raw } })).rejects.toThrow(
    'browser accessibility/extraction syntax',
  );
  expect(service.board.list<Card>('card')).toHaveLength(0);
});

it('rejects unevidenced browser extraction, then saves every heading, paragraph and bullet on a readable retry', async () => {
  const { service, navigate, importLink, changePage } = await fixture();
  await navigate();
  const before = service.board.events().length;
  await expect(
    importLink({ details: { ...details, description: rawPostingExtraction } }),
  ).rejects.toThrow('could not be converted safely');
  changePage({ text: rawPostingExtraction });
  expect(service.board.list<Card>('card')).toEqual([]);
  expect(service.board.events()).toHaveLength(before);
  expect((await importLink({ details: undefined })).result).toMatchObject({
    status: 'needs_details',
    text: rawPostingExtraction,
    reason: expect.stringContaining('full original posting wording'),
  });
  expect(
    (await importLink({ details: { ...details, description: readablePosting } })).result.status,
  ).toBe('added');
  const [card] = service.board.list<Card>('card');
  expect(card.description).toBe(readablePosting);
  let position = -1;
  for (const paragraph of postingParagraphs) {
    const next = card.description.indexOf(paragraph);
    expect(next).toBeGreaterThan(position);
    position = next;
  }
  expect(card.description).toContain('\n\nWhat you’ll do\n\n- Build accessible');
  expect(card.description).not.toMatch(/heading "|\[level=|paragraph:|list:|listitem:/);
  service.board.rebuild();
  expect(service.board.get<Card>('card', card.id).description).toBe(readablePosting);
});

it('rejects unevidenced extraction on refresh without changing the saved record or its history', async () => {
  const { service, navigate, importLink } = await fixture();
  await navigate();
  await importLink();
  const [card] = service.board.list<Card>('card');
  const history = service.board.history(card.id);
  await expect(
    importLink({ cardId: card.id, details: { ...details, description: rawPostingExtraction } }),
  ).rejects.toThrow('could not be converted safely');
  expect(service.board.get<Card>('card', card.id)).toEqual(card);
  expect(service.board.history(card.id)).toEqual(history);
});

it('returns all available browser evidence and rejects an over-limit retry without truncating it', async () => {
  const { service, navigate, importLink, changePage } = await fixture();
  await navigate();
  const text = `${'Full posting text. '.repeat(1200)}Final source paragraph.`;
  changePage({ text });
  expect((await importLink({ details: undefined })).result).toMatchObject({
    text,
    reason: expect.stringContaining('20,000-character save limit'),
  });
  await expect(importLink({ details: { ...details, description: text } })).rejects.toThrow();
  expect(service.board.list<Card>('card')).toEqual([]);
});

it.each(['permission', 'cancelled', 'manual'] as const)(
  'does not save after %s changes while inspecting',
  async (kind) => {
    const { service, navigate, importLink, driver, controller, setPermissions } = await fixture();
    const page = (await navigate()) as BrowserSnapshot;
    driver.snapshot.mockImplementationOnce(async () => {
      if (kind === 'permission') setPermissions({ computerUse: false });
      if (kind === 'cancelled') controller.abort();
      if (kind === 'manual') service.computer.takeControl(runId);
      return page;
    });
    await expect(importLink()).rejects.toThrow();
    expect(service.board.list<Card>('card')).toEqual([]);
  },
);

it('refreshes an explicit existing job and keeps its status and notes', async () => {
  const { service, navigate, importLink } = await fixture();
  await navigate();
  await importLink();
  const [card] = service.board.list<Card>('card');
  service.board.record(
    'card',
    {
      ...card,
      state: 'shortlisted',
      tracking: { origin: 'external', gmailThreads: [], note: 'Keep my notes' },
      location: 'Haifa',
      salary: 'Saved salary',
    },
    'user',
    'Fixture bookkeeping',
  );
  expect(
    (
      await importLink({
        cardId: card.id,
        details: { ...details, description: 'Build accessible applications.' },
      })
    ).result.status,
  ).toBe('updated');
  expect(service.board.list<Card>('card')).toHaveLength(1);
  expect(service.board.get<Card>('card', card.id)).toMatchObject({
    state: 'shortlisted',
    tracking: { origin: 'external', gmailThreads: [], note: 'Keep my notes' },
    location: 'Haifa',
    salary: 'Saved salary',
    description: 'Build accessible applications.',
  });
});

it('rejects another attached job and a target changed during browser inspection', async () => {
  const { service, navigate, importLink, driver } = await fixture();
  const page = (await navigate()) as BrowserSnapshot;
  await importLink();
  const [card] = service.board.list<Card>('card');
  service.capabilities.set(token, { runId, roleId: 'scout', cardId: 'other-job' });
  await expect(importLink({ cardId: card.id })).rejects.toThrow('scoped to the attached job');
  service.capabilities.set(token, { runId, roleId: 'scout', cardId: null });
  driver.snapshot.mockImplementationOnce(async () => {
    service.board.record(
      'card',
      { ...card, description: 'Changed by user' },
      'user',
      'Fixture change',
    );
    return page;
  });
  await expect(importLink({ cardId: card.id })).rejects.toThrow('changed while reading');
  expect(service.board.get<Card>('card', card.id).description).toBe('Changed by user');
});

it('keeps provider identity and removes a Comeet token from saved browser imports', async () => {
  const { service, navigate, importLink, changePage } = await fixture();
  await navigate();
  const posting = 'https://www.comeet.co/jobs/A1.B2C/A1.00D';
  changePage({ url: `${posting}?token=fixtureToken` });
  expect((await importLink({ url: posting })).result.status).toBe('added');
  const [card] = service.board.list<Card>('card');
  expect(card.url).not.toContain('token');
  expect(card.discovery).toMatchObject({ provider: 'comeet', jobId: 'A1.00D' });
  expect(JSON.stringify(service.board.events())).not.toContain('fixtureToken');
});
