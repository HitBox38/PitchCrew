import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Role, Skill } from '@pitchcrew/core';
import { skillDirectory } from '../../orchestrator/src/skills-directory.ts';
import { cleanup, directorySkill, setup } from '../../orchestrator/test/helpers/daemon.ts';

const viteCache = vi.hoisted(() => ({ directory: '' }));
vi.mock('vite', async (importOriginal) => {
  const vite = await importOriginal<typeof import('vite')>();
  return {
    ...vite,
    createServer: (config: import('vite').InlineConfig) =>
      vite.createServer({ ...config, cacheDir: viteCache.directory }),
  };
});
let host: Awaited<ReturnType<typeof setup>>;
let browser: Browser;
let page: Page;
let skill: Skill;
let revision = 'b';
let unavailable = false;
const errors: string[] = [];
const input = { ...directorySkill, scope: 'roles', roleIds: ['reviewer'] };

beforeAll(async () => {
  viteCache.directory = await mkdtemp(join(tmpdir(), 'pitchcrew-updates-ui-cache-'));
  host = await setup(15739);
  host.daemon.service.onboarding.save({ version: 1, status: 'dismissed', step: 0 });
  const scout = host.daemon.service.board.get<Role>('role', 'scout');
  host.daemon.service.board.record(
    'role',
    {
      ...scout,
      instructions:
        'Evaluate the provided job against the profile. Explain the fit. Never invent jobs or qualifications.',
    },
    'system',
    'Fictional old instructions',
  );
  vi.spyOn(skillDirectory, 'preview').mockImplementation(async () => {
    if (unavailable) throw new Error('Fictional offline source');
    return {
      ...directorySkill,
      content: `Fictional upstream revision ${revision}.`,
      source: { ...directorySkill.source!, blobSha: revision.repeat(40) },
    };
  });
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.message));
}, 60000);

beforeEach(async () => {
  revision = 'b';
  unavailable = false;
  if (skill) host.daemon.service.deleteSkill(skill.id);
  skill = host.daemon.service.saveSkill(input);
  await host.daemon.service.checkSkillUpdates(false);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${host.daemon.url}/skills`, { waitUntil: 'domcontentloaded' });
  await page
    .getByRole('link', { name: 'Skills (1 update)', exact: true })
    .waitFor({ timeout: 30000 });
}, 30000);

afterAll(async () => {
  await browser?.close();
  await cleanup();
  if (viteCache.directory) await rm(viteCache.directory, { recursive: true, force: true });
});

test('notification review, dismissal, rediscovery and explicit replacement update durable badges', async () => {
  const skillLink = () => page.getByRole('link', { name: /^Skills \(/, includeHidden: true });
  await page.getByRole('textbox', { name: 'Search skills', exact: true }).fill('no-matching-skill');
  await page.getByRole('button', { name: /^Notifications,/ }).click();
  await page.getByRole('button', { name: 'Mark all read' }).click();
  expect(await skillLink().getAttribute('aria-label')).toBe('Skills (1 update)');
  await page
    .getByRole('link')
    .filter({ hasText: 'evidence-checklist has an upstream update' })
    .click();
  const review = page.getByRole('dialog', { name: 'Review skill update' });
  await review.waitFor();
  await review.getByRole('button', { name: 'Replace with upstream version' }).waitFor();
  expect(await review.textContent()).toContain('including any local edits');
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await review.waitFor({ state: 'hidden' });
  await page.goForward({ waitUntil: 'domcontentloaded' });
  await review.getByRole('button', { name: 'Replace with upstream version' }).waitFor();
  await review.getByRole('button', { name: 'Keep mine', exact: true }).click();
  await expect.poll(async () => host.daemon.service.skills()[0].content).toBe(input.content);
  await page.getByRole('link', { name: 'Skills', exact: true }).waitFor();
  expect(await page.getByText('Dismissed version', { exact: false }).count()).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Check now', exact: true }).click();
  await page.getByRole('button', { name: 'Check now', exact: true }).waitFor();
  expect(await skillLink().count()).toBe(0);
  revision = 'c';
  await page.getByRole('button', { name: 'Check now', exact: true }).click();
  await skillLink().waitFor();
  await page.getByRole('button', { name: 'Updates only', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('updates')).toBe('true');
  await page.getByRole('button', { name: 'Review update', exact: true }).click();
  await review.getByRole('button', { name: 'Replace with upstream version' }).click();
  await page.getByRole('link', { name: 'Skills', exact: true }).waitFor();
  expect(host.daemon.service.skills()[0]).toMatchObject({
    content: 'Fictional upstream revision c.',
    roleIds: ['reviewer'],
  });
  // Keep Skills mounted while Crew loads so shared button labels cannot hide a navigation race.
  let crewLoadDelayed = false;
  await page.route(
    '**/src/CrewPage/index.tsx*',
    async (route) => {
      crewLoadDelayed = true;
      await new Promise((resolve) => setTimeout(resolve, 750));
      await route.continue();
    },
    { times: 1 },
  );
  await page.getByRole('link', { name: 'Crew (1 update)', exact: true }).click();
  await page
    .getByRole('region', { name: 'Instruction updates', exact: true })
    .getByRole('button', { name: 'Updates only', exact: true })
    .click();
  expect(crewLoadDelayed).toBe(true);
  await expect.poll(() => page.locator('.crew-card').count()).toBe(1);
  await page.getByRole('button', { name: 'Review update', exact: true }).click();
  await page.locator('.instruction-update').waitFor();
  expect((await page.locator('.instruction-update').boundingBox())!.y).toBeLessThan(300);
  await page.getByRole('button', { name: 'Keep mine', exact: true }).click();
  await page.getByRole('button', { name: 'Close agent settings', exact: true }).click();
  await page.getByRole('link', { name: 'Crew', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Review update', exact: true }).click();
  await page.getByRole('button', { name: 'Close agent settings', exact: true }).click();
  await page.getByRole('button', { name: 'Review update', exact: true }).click();
  await page.getByRole('button', { name: 'Close agent settings', exact: true }).waitFor();
  expect(errors).toEqual([]);
}, 30000);

test('collapsed and mobile sidebars retain the update reminder and a direct review remains usable', async () => {
  await page.locator('[data-slot=sidebar-trigger]').click();
  const indicator = page
    .locator('[data-collapsible="icon"] [data-sidebar="menu-item"]')
    .filter({
      has: page.getByRole('link', {
        name: 'Skills (1 update)',
        exact: true,
        includeHidden: true,
      }),
    })
    .locator('.sidebar-update-badge');
  await indicator.waitFor();
  expect(await indicator.evaluate((element) => getComputedStyle(element).display)).toBe('flex');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-slot=sidebar-trigger]').click();
  await page.getByRole('link', { name: 'Skills (1 update)', exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await page.goto(`${host.daemon.url}/skills?skill=${skill.id}&review=true`, {
    waitUntil: 'domcontentloaded',
  });
  const review = page.getByRole('dialog', { name: 'Review skill update' });
  await review.getByRole('button', { name: 'Replace with upstream version' }).waitFor();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
}, 30000);

test('automatic-check preferences persist and failed manual checks retain the reminder', async () => {
  await page.goto(`${host.daemon.url}/settings?section=general`, { waitUntil: 'domcontentloaded' });
  const automatic = page.getByRole('switch', { name: /Check skills automatically/ });
  await automatic.waitFor();
  await automatic.click();
  await expect
    .poll(async () => (await host.daemon.service.snapshot()).skillUpdates!.automatic)
    .toBe(false);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await automatic.waitFor();
  expect(await automatic.isChecked()).toBe(false);
  unavailable = true;
  await page.getByRole('button', { name: 'Check now', exact: true }).click();
  await expect
    .poll(async () => (await host.daemon.service.snapshot()).skillUpdates!.checks[0]?.error)
    .toContain('Couldn’t check');
  await page.goto(`${host.daemon.url}/skills`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('link', { name: 'Skills (1 update)', exact: true }).waitFor();
  await page.getByText('Couldn’t check:', { exact: false }).waitFor();
  expect(await page.getByText('Last successful check', { exact: false }).count()).toBeGreaterThan(
    0,
  );
  expect(errors).toEqual([]);
}, 30000);
