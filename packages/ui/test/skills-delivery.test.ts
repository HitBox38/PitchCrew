import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { skillDirectory } from '../../orchestrator/src/skills-directory.ts';
import { cleanup, directorySkill, setup } from './helpers/daemon.ts';

let host: Awaited<ReturnType<typeof setup>>;
let browser: Browser;
let page: Page;
const errors: string[] = [];

beforeAll(async () => {
  host = await setup();
  host.daemon.service.onboarding.save({ version: 1, status: 'dismissed', step: 0 });
  browser = await chromium.launch({ headless: true });
}, 60000);

beforeEach(async () => {
  for (const skill of host.daemon.service.skills()) host.daemon.service.deleteSkill(skill.id);
  errors.length = 0;
  page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${host.daemon.url}/skills`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Add skill', exact: true }).waitFor();
});

afterEach(async () => {
  await page?.close();
  vi.restoreAllMocks();
  expect(errors).toEqual([]);
});

afterAll(async () => {
  await browser?.close();
  await cleanup();
});

test('delivery-only edits have unsaved protection and save the selected mode', async () => {
  await page.getByRole('button', { name: 'Add skill', exact: true }).click();
  const form = page.getByRole('form', { name: 'New skill', exact: true });
  const include = form.getByRole('switch', { name: 'Include in every run', exact: true });
  expect(await include.isChecked()).toBe(true);
  await include.click();
  await form.getByRole('button', { name: 'Cancel', exact: true }).click();
  const discard = page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true });
  await discard.getByRole('button', { name: 'Keep editing', exact: true }).click();
  expect(await include.isChecked()).toBe(false);
  await form.getByRole('textbox', { name: 'Name', exact: true }).fill('Writing procedure');
  await form.getByRole('textbox', { name: 'Skill Markdown', exact: true }).fill('Use clear prose.');
  await form.getByRole('button', { name: /^Add skill/ }).click();
  await page.getByRole('button', { name: 'Edit Writing procedure', exact: true }).waitFor();
  expect(host.daemon.service.skills()[0]).toMatchObject({ includeInEveryRun: false });
  await page.getByText('Read when relevant', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Edit Writing procedure', exact: true }).click();
  const edit = page.getByRole('form', { name: 'Edit Writing procedure', exact: true });
  const editedInclude = edit.getByRole('switch', { name: 'Include in every run', exact: true });
  expect(await editedInclude.isChecked()).toBe(false);
  await editedInclude.click();
  await edit.getByRole('button', { name: /^Save/ }).click();
  await page.getByText('Included in every run', { exact: true }).waitFor();
  expect(host.daemon.service.skills()[0]).toMatchObject({ includeInEveryRun: true });
}, 30000);

test('imports default to relevant loading and keep an explicit choice when loading source text', async () => {
  vi.spyOn(skillDirectory, 'preview').mockResolvedValue(directorySkill);
  await page.getByRole('button', { name: 'Import from skills.sh', exact: true }).click();
  const form = page.getByRole('form', { name: 'New skill', exact: true });
  const include = form.getByRole('switch', { name: 'Include in every run', exact: true });
  expect(await include.isChecked()).toBe(false);
  await include.click();
  await form.getByRole('textbox', { name: /^skills.sh link/ }).fill(directorySkill.source!.url);
  await form.getByRole('button', { name: 'Load skill', exact: true }).click();
  await expect
    .poll(() => form.getByRole('textbox', { name: 'Name', exact: true }).inputValue())
    .toBe(directorySkill.name);
  expect(await include.isChecked()).toBe(true);
  await form.getByRole('button', { name: /^Add skill/ }).click();
  await page.getByRole('button', { name: `Edit ${directorySkill.name}`, exact: true }).waitFor();
  expect(host.daemon.service.skills()[0]).toMatchObject({
    includeInEveryRun: true,
    source: directorySkill.source,
  });
  await page.getByRole('button', { name: 'Import from skills.sh', exact: true }).click();
  expect(
    await form.getByRole('switch', { name: 'Include in every run', exact: true }).isChecked(),
  ).toBe(false);
}, 30000);
