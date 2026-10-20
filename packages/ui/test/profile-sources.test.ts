import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ProfileMaintenanceProposal, ProfileSource, Snapshot } from '@pitchcrew/core';
import { cleanup, setup } from '../../orchestrator/test/helpers/daemon.ts';
import { createProposal, importSource, sourceFixture } from './helpers/profile-sources.ts';
const openSources = async () => {
  await page.goto(`${host.daemon.url}/profile`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Set up later', exact: true }).click();
  await page.getByRole('button', { name: /^Sources/ }).click();
  await dialog().waitFor();
};
const githubNotes = async () => {
  await sources()
    .getByRole('button', { name: /^GitHub / })
    .click();
  await sources()
    .getByRole('button', { name: /^Import profile notes / })
    .click();
  await sources()
    .getByRole('textbox', { name: 'Repository URL or owner/repository' })
    .fill('fictional/profile');
};
const deferred = async (pattern: string) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  releases.push(release);
  await page.route(pattern, async (route) => {
    await gate;
    await route.continue();
  });
  return release;
};
const focused = async () => {
  return page.evaluate(() => document.activeElement?.textContent);
};

const viteCache = vi.hoisted(() => ({ directory: '' }));
vi.mock('vite', async (importOriginal) => {
  const vite = await importOriginal<typeof import('vite')>();
  return {
    ...vite,
    createServer: (config: import('vite').InlineConfig) =>
      vite.createServer({ ...config, cacheDir: viteCache.directory }),
  };
});
let browser: Browser;
let context: BrowserContext;
let page: Page;
let host: Awaited<ReturnType<typeof setup>>;
let remote: ReturnType<typeof sourceFixture>;
let releases: (() => void)[];
const errors: string[] = [];
const dialog = () => page.getByRole('dialog', { name: 'Profile sources', exact: true });
const sources = () => page.locator('.profile-sources-dialog');

beforeAll(async () => {
  viteCache.directory = await mkdtemp(join(tmpdir(), 'pitchcrew-profile-ui-cache-'));
  browser = await chromium.launch({ headless: true });
}, 60000);
beforeEach(async () => {
  releases = [];
  errors.length = 0;
  host = await setup(14610);
  remote = sourceFixture(host);
  context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.message));
}, 60000);
afterEach(async () => {
  releases.forEach((release) => release());
  await context?.close();
  await cleanup();
  vi.restoreAllMocks();
  expect(errors).toEqual([]);
});
afterAll(async () => {
  await browser?.close();
  await rm(viteCache.directory, { recursive: true, force: true });
});

test('initial loading has a spinner, failed loading has retry, and setup stays in the dialog', async () => {
  const release = await deferred('**/api/profile/sources');
  await openSources();
  await sources().getByRole('status').filter({ hasText: 'Loading sources…' }).waitFor();
  expect(
    await sources().getByRole('heading', { name: 'Bring your background together' }).count(),
  ).toBe(0);
  expect(await sources().locator('output svg').count()).toBe(1);
  release();
  await sources().getByRole('heading', { name: 'Bring your background together' }).waitFor();
  await githubNotes();
  await sources().getByRole('button', { name: 'Back to sources' }).click();
  await expect.poll(focused).toContain('GitHub');
  await sources()
    .getByRole('button', { name: /^Google Drive / })
    .click();
  await sources().getByRole('textbox', { name: 'Google Drive folder link' }).waitFor();
  expect(
    await sources().getByRole('textbox', { name: 'Repository URL or owner/repository' }).count(),
  ).toBe(0);
  await sources().getByRole('button', { name: 'Cancel', exact: true }).click();
  await sources().getByRole('button', { name: 'Close', exact: true }).click();
  await page.unroute('**/api/profile/sources');
  await page.route('**/api/profile/sources', (route) =>
    route.fulfill({ status: 503, json: { error: 'Fictional list unavailable.' } }),
  );
  await page.getByRole('button', { name: /^Sources/ }).click();
  await sources().getByRole('alert').filter({ hasText: 'Fictional list unavailable.' }).waitFor();
  expect(
    await sources().getByRole('heading', { name: 'Bring your background together' }).count(),
  ).toBe(0);
  await page.unroute('**/api/profile/sources');
  await sources().getByRole('button', { name: 'Retry loading sources' }).click();
  await sources().getByRole('heading', { name: 'Bring your background together' }).waitFor();
}, 30000);

test('source reads and imports survive closing and navigation while retaining the reviewed snapshot', async () => {
  await openSources();
  await githubNotes();
  const read = await deferred('**/api/profile/sources/preview');
  await sources().getByRole('button', { name: 'Review documents', exact: true }).click();
  await sources().getByRole('status').filter({ hasText: 'Reading GitHub documents…' }).waitFor();
  expect(
    await sources()
      .getByRole('textbox', { name: 'Repository URL or owner/repository' })
      .isDisabled(),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(() => sources().isVisible()).toBe(false);
  await page.getByRole('link', { name: 'Activity', exact: true }).click();
  const activity = page.getByRole('region', { name: 'Profile source activity' });
  await activity.getByRole('status').filter({ hasText: 'Reading GitHub documents…' }).waitFor();
  read();
  await activity
    .getByRole('status')
    .filter({ hasText: 'Profile documents ready to review.' })
    .waitFor();
  expect(
    await page.locator('.profile-sources-dialog, .profile-import-panel').allTextContents(),
  ).toEqual([]);
  await activity.getByRole('link', { name: 'Open profile sources' }).click();
  const review = page.getByRole('dialog', { name: 'Review profile documents' });
  await review.waitFor();
  remote.content = 'Changed after the review snapshot';
  const save = await deferred('**/api/profile/sources/import');
  await review.getByRole('button', { name: 'Import 1 document', exact: true }).click();
  await review.getByRole('status').filter({ hasText: 'Importing documents…' }).waitFor();
  await review.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect
    .poll(() => page.locator('.profile-sources-dialog, .profile-import-panel').count())
    .toBe(0);
  await page.getByRole('link', { name: 'Activity', exact: true }).click();
  await activity.getByRole('status').filter({ hasText: 'Importing documents…' }).waitFor();
  await activity.getByRole('link', { name: 'Open profile sources' }).click();
  await review.getByRole('button', { name: 'Importing…', exact: true }).waitFor();
  expect(await review.getByRole('button', { name: 'Importing…', exact: true }).isDisabled()).toBe(
    true,
  );
  await page.keyboard.press('Escape');
  await expect
    .poll(() => page.locator('.profile-sources-dialog, .profile-import-panel').count())
    .toBe(0);
  await page.getByRole('link', { name: 'Activity', exact: true }).click();
  save();
  await expect.poll(() => activity.count()).toBe(0);
  expect(
    await page.locator('.profile-sources-dialog, .profile-import-panel').allTextContents(),
  ).toEqual([]);
  await page.getByRole('link', { name: /^Profile(?: \(\d+\))?$/ }).click();
  await page.getByRole('button', { name: /^Sources/ }).click();
  await dialog().getByRole('status').filter({ hasText: 'Profile notes imported.' }).waitFor();
  const { result: snapshot } = await host.request<Snapshot>('/snapshot');
  const note = snapshot.profile.find((file) =>
    file.content.includes('Built a fictional scheduling tool.'),
  )!;
  expect(note).toBeDefined();
  expect(await dialog().isVisible()).toBe(true);
  await dialog().getByRole('button', { name: 'Open note', exact: true }).click();
  await expect.poll(() => sources().count()).toBe(0);
  expect(await page.getByRole('textbox', { name: 'Profile Markdown' }).inputValue()).toBe(
    note.content,
  );
}, 30000);

test('failed reads preserve source details and can be retried', async () => {
  await openSources();
  await githubNotes();
  remote.fail = true;
  await sources().getByRole('button', { name: 'Review documents', exact: true }).click();
  await sources()
    .getByRole('alert')
    .filter({ hasText: 'Fictional source is temporarily unavailable.' })
    .waitFor();
  expect(
    await sources()
      .getByRole('textbox', { name: 'Repository URL or owner/repository' })
      .inputValue(),
  ).toBe('fictional/profile');
  remote.fail = false;
  await sources().getByRole('button', { name: 'Review documents', exact: true }).click();
  await page.getByRole('dialog', { name: 'Review profile documents' }).waitFor();
});

test('project setup has a dedicated action, visible progress, a watching switch and safe removal', async () => {
  await openSources();
  await sources()
    .getByRole('button', { name: /^GitHub / })
    .click();
  expect(await sources().getByRole('textbox').count()).toBe(0);
  await sources()
    .getByRole('button', { name: /^Watch a project / })
    .click();
  await sources()
    .getByRole('textbox', { name: 'Repository URL or owner/repository' })
    .fill('fictional/project');
  expect(
    await sources().getByRole('textbox', { name: 'Project folder (optional)' }).inputValue(),
  ).toBe('');
  expect(
    await sources().getByRole('button', { name: 'Review documents', exact: true }).count(),
  ).toBe(0);
  const release = await deferred('**/api/profile/sources/project');
  await sources().getByRole('button', { name: 'Watch project', exact: true }).click();
  await sources().getByRole('status').filter({ hasText: 'Checking project…' }).waitFor();
  release();
  await dialog().getByRole('status').filter({ hasText: 'Project watch added.' }).waitFor();
  const watching = dialog().getByRole('switch', { name: 'Watching fictional/project/' });
  await expect.poll(() => watching.isEnabled()).toBe(true);
  expect(await watching.isChecked()).toBe(true);
  expect(await dialog().getByText('Tracking revision aaaaaaaa', { exact: true }).count()).toBe(1);
  const pause = await deferred('**/api/profile/sources/*/watch');
  await watching.click();
  await dialog().getByRole('status').filter({ hasText: 'Pausing watching…' }).waitFor();
  pause();
  await expect.poll(() => watching.isChecked()).toBe(false);
  await expect.poll(() => watching.isEnabled()).toBe(true);
  await dialog().getByRole('button', { name: 'Actions for fictional/project/' }).click();
  await page.getByRole('menuitem', { name: 'Remove source' }).click();
  await dialog()
    .getByRole('status')
    .filter({ hasText: 'Source removed. Local notes were kept.' })
    .waitFor();
  await dialog().getByRole('heading', { name: 'Bring your background together' }).waitFor();
  await expect.poll(focused).toContain('GitHub');
  expect((await host.request<ProfileSource[]>('/profile/sources')).result).toEqual([]);
}, 30000);

test('Drive imports retain the existing review and return to the source list', async () => {
  await openSources();
  await sources()
    .getByRole('button', { name: /^Google Drive / })
    .click();
  await sources()
    .getByRole('textbox', { name: 'Google Drive folder link' })
    .fill('https://drive.google.com/drive/folders/fictional-folder');
  await sources().getByRole('button', { name: 'Review documents', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Review profile documents' });
  await review.getByRole('button', { name: 'Import 1 document', exact: true }).click();
  await dialog().getByRole('status').filter({ hasText: 'Profile notes imported.' }).waitFor();
  expect((await host.request<ProfileSource[]>('/profile/sources')).result[0].input.provider).toBe(
    'drive',
  );
});

test('proposal badges lead to focused review, require fact verification and return to sources after applying', async () => {
  await importSource(host);
  remote.content = '# Background\n\nA reviewed fictional update.';
  const proposal = await createProposal(host);
  await openSources();
  expect(
    await dialog().getByText('I reviewed the selected documents', { exact: false }).count(),
  ).toBe(0);
  await dialog()
    .getByRole('button', { name: `Review ${proposal.source.label}`, exact: true })
    .click();
  const review = page.getByRole('dialog', { name: 'Review profile updates' });
  const apply = review.getByRole('button', { name: 'Apply selected updates', exact: true });
  expect(await apply.isDisabled()).toBe(true);
  await review.getByRole('button', { name: 'Back to sources' }).click();
  await expect.poll(focused).toBe('Review');
  await dialog()
    .getByRole('button', { name: `Review ${proposal.source.label}`, exact: true })
    .click();
  await review.getByRole('checkbox', { name: /^I reviewed the selected documents/ }).check();
  const release = await deferred(`**/api/profile/proposals/${proposal.id}/decide`);
  await apply.click();
  await review.getByRole('status').filter({ hasText: 'Applying profile updates…' }).waitFor();
  await page.keyboard.press('Escape');
  expect(await review.isVisible()).toBe(true);
  release();
  await dialog()
    .getByRole('status')
    .filter({ hasText: 'Verified profile updates applied.' })
    .waitFor();
  expect(
    host.daemon.service.board.get<ProfileMaintenanceProposal>('profile_proposal', proposal.id)
      .status,
  ).toBe('applied');
  expect(await dialog().getByRole('button', { name: 'Open note', exact: true }).count()).toBe(1);
}, 30000);

test('interrupted approved updates keep their frozen selection and retry controls', async () => {
  await importSource(host);
  remote.content = '# Background\n\nA recovered fictional update.';
  const proposal = await createProposal(host, true);
  await openSources();
  await dialog().getByText('Update needs recovery', { exact: true }).waitFor();
  await dialog()
    .getByRole('button', { name: `Review ${proposal.source.label}`, exact: true })
    .click();
  const review = page.getByRole('dialog', { name: 'Review profile updates' });
  expect(await review.getByRole('button', { name: 'Reject', exact: true }).isDisabled()).toBe(true);
  expect(
    await review.getByRole('checkbox', { name: /^I reviewed the selected documents/ }).isDisabled(),
  ).toBe(true);
  await review.getByRole('button', { name: 'Retry approved update', exact: true }).click();
  await dialog()
    .getByRole('status')
    .filter({ hasText: 'Verified profile updates applied.' })
    .waitFor();
  expect(
    host.daemon.service.board.get<ProfileMaintenanceProposal>('profile_proposal', proposal.id)
      .selected,
  ).toEqual(proposal.selected);
});

test('long source lists and focused setup fit a narrow viewport with reduced motion', async () => {
  await importSource(host);
  remote.content = 'A fictional update for the last source.';
  const proposal = await createProposal(host);
  await page.setViewportSize({ width: 390, height: 700 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  const original = (await host.request<ProfileSource[]>('/profile/sources')).result[0];
  await page.route('**/api/profile/sources', (route) =>
    route.fulfill({
      json: [
        ...Array.from({ length: 19 }, (_, i) => ({
          ...original,
          id: i.toString(16).padStart(24, '0'),
          label: `fictional/very-long-profile-source-${i}/deeply/nested/background-notes`,
        })),
        original,
      ],
    }),
  );
  await openSources();
  await dialog().getByRole('button', { name: 'Add source', exact: true }).waitFor();
  const bounds = await dialog().evaluate((element) => {
    const box = element.getBoundingClientRect();
    const panel = element.querySelector('.profile-sources-panel')!;
    return {
      left: box.left,
      right: box.right,
      top: box.top,
      bottom: box.bottom,
      scrollable: panel.scrollHeight > panel.clientHeight,
      overflow: panel.scrollWidth > panel.clientWidth,
    };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(390);
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.bottom).toBeLessThanOrEqual(700);
  expect(bounds.scrollable).toBe(true);
  expect(bounds.overflow).toBe(false);
  const reviewButton = dialog().getByRole('button', {
    name: `Review ${proposal.source.label}`,
    exact: true,
  });
  await reviewButton.click();
  await sources().getByRole('button', { name: 'Back to sources' }).click();
  await expect.poll(focused).toBe('Review');
  const restoredFocus = await reviewButton.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const panel = element.closest('.profile-sources-panel')!.getBoundingClientRect();
    return {
      visible: box.top >= panel.top && box.bottom <= panel.bottom,
      box: box.toJSON(),
      panel: panel.toJSON(),
      scrollTop: element.closest('.profile-sources-panel')!.scrollTop,
    };
  });
  expect(restoredFocus.visible, JSON.stringify(restoredFocus)).toBe(true);
  await dialog().getByRole('button', { name: 'Add source', exact: true }).click();
  await githubNotes();
  expect(await sources().evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await sources().getByRole('button', { name: 'Back to sources' }).click();
  await expect.poll(focused).toContain('Add source');
}, 30000);

test('an import still protects unsaved Profile drafts before writing notes', async () => {
  await openSources();
  await dialog().getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('textbox', { name: 'Profile Markdown' }).fill('# Unsaved local work');
  const before = (await host.request<Snapshot>('/snapshot')).result.profile;
  await page.getByRole('button', { name: /^Sources/ }).click();
  await githubNotes();
  await sources().getByRole('button', { name: 'Review documents', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Review profile documents' });
  await review.getByRole('button', { name: 'Import 1 document', exact: true }).click();
  const guard = page.getByRole('dialog', { name: 'Discard unsaved changes?' });
  await guard.getByRole('button', { name: 'Keep editing', exact: true }).click();
  expect((await host.request<Snapshot>('/snapshot')).result.profile).toEqual(before);
  await review.getByRole('button', { name: 'Import 1 document', exact: true }).click();
  await guard.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await dialog().getByRole('status').filter({ hasText: 'Profile notes imported.' }).waitFor();
  expect((await host.request<Snapshot>('/snapshot')).result.profile.length).toBeGreaterThan(
    before.length,
  );
});

test('failed refreshes keep existing sources and removing an import keeps its local notes', async () => {
  await importSource(host);
  const before = (await host.request<Snapshot>('/snapshot')).result.profile;
  await openSources();
  await dialog().getByRole('switch').waitFor();
  await dialog().getByRole('button', { name: 'Close', exact: true }).click();
  await page.route('**/api/profile/sources', (route) =>
    route.fulfill({ status: 503, json: { error: 'Fictional refresh unavailable.' } }),
  );
  await page.getByRole('button', { name: /^Sources/ }).click();
  await dialog().getByRole('alert').filter({ hasText: 'Fictional refresh unavailable.' }).waitFor();
  expect(
    await dialog()
      .getByRole('listitem', { name: 'fictional/profile/about-me', exact: true })
      .count(),
  ).toBe(1);
  await page.unroute('**/api/profile/sources');
  await dialog().getByRole('button', { name: 'Retry loading sources' }).click();
  await expect
    .poll(() =>
      dialog().getByRole('button', { name: 'Actions for fictional/profile/about-me' }).isEnabled(),
    )
    .toBe(true);
  await dialog().getByRole('button', { name: 'Actions for fictional/profile/about-me' }).click();
  await page.getByRole('menuitem', { name: 'Remove source' }).click();
  await dialog().getByRole('status').filter({ hasText: 'Source removed.' }).waitFor();
  expect((await host.request<Snapshot>('/snapshot')).result.profile).toEqual(before);
});

test('unlinked proposals remain reviewable, local conflicts start unselected and rejection keeps local edits', async () => {
  const imported = await importSource(host);
  await host.daemon.service.saveProfile(imported.files[0].name, 'A local verified edit.');
  remote.content = 'A proposed remote replacement.';
  const proposal = await createProposal(host);
  await host.request(`/profile/sources/${proposal.source.id}`, 'DELETE');
  await openSources();
  await dialog().getByText('This source is no longer connected.', { exact: false }).waitFor();
  await dialog()
    .getByRole('button', { name: `Review ${proposal.source.label}`, exact: true })
    .click();
  const review = page.getByRole('dialog', { name: 'Review profile updates' });
  await review
    .getByRole('button')
    .filter({ hasText: 'Replaces a local note; review carefully' })
    .click();
  const selected = review.getByRole('checkbox', { name: 'Apply this document', exact: true });
  expect(await selected.isChecked()).toBe(false);
  await selected.check();
  expect(await selected.isChecked()).toBe(true);
  await review.getByRole('button', { name: 'Reject', exact: true }).click();
  await dialog().getByRole('status').filter({ hasText: 'Profile updates rejected.' }).waitFor();
  expect(
    host.daemon.service.board.get<ProfileMaintenanceProposal>('profile_proposal', proposal.id)
      .status,
  ).toBe('rejected');
  expect(
    (await host.request<Snapshot>('/snapshot')).result.profile.find(
      (file) => file.name === imported.files[0].name,
    )?.content,
  ).toBe('A local verified edit.');
  expect(await dialog().getByRole('button', { name: 'Open note', exact: true }).count()).toBe(0);
});

test('failed background reads preserve setup and allow retry after returning to Profile', async () => {
  await openSources();
  await githubNotes();
  remote.fail = true;
  const release = await deferred('**/api/profile/sources/preview');
  await sources().getByRole('button', { name: 'Review documents', exact: true }).click();
  await sources().getByRole('status').filter({ hasText: 'Reading GitHub documents…' }).waitFor();
  await sources().getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('link', { name: 'Activity', exact: true }).click();
  release();
  await expect
    .poll(() => page.getByRole('region', { name: 'Profile source activity' }).count())
    .toBe(0);
  await page.getByRole('link', { name: /^Profile(?: \(\d+\))?$/ }).click();
  await page.getByRole('button', { name: /^Sources/ }).click();
  await sources()
    .getByRole('alert')
    .filter({ hasText: 'Fictional source is temporarily unavailable.' })
    .waitFor();
  expect(
    await sources()
      .getByRole('textbox', { name: 'Repository URL or owner/repository' })
      .inputValue(),
  ).toBe('fictional/profile');
  remote.fail = false;
  await page.unroute('**/api/profile/sources/preview');
  await sources().getByRole('button', { name: 'Review documents', exact: true }).click();
  await page.getByRole('dialog', { name: 'Review profile documents' }).waitFor();
});
