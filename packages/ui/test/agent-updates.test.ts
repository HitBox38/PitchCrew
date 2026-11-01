import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import type { Role, Skill } from '@pitchcrew/core';
import { skillDirectory } from '../../orchestrator/src/skills-directory.ts';
import { cleanup, directorySkill, setup } from './helpers/daemon.ts';
import { skillsUpdateCount } from './helpers/navigation.ts';

let host: Awaited<ReturnType<typeof setup>>;
let browser: Browser;
let page: Page;
let skill: Skill;
let revision = 'b';
let unavailable = false;
const errors: string[] = [];
const input = { ...directorySkill, scope: 'roles', roleIds: ['reviewer'] };

beforeAll(async () => {
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
  await expect.poll(() => skillsUpdateCount(page), { timeout: 30000 }).toBe(1);
}, 45000);

afterAll(async () => {
  await browser?.close();
  await cleanup();
});

test('notification review, dismissal, rediscovery and explicit replacement update durable badges', async () => {
  await page.getByRole('textbox', { name: 'Search skills', exact: true }).fill('no-matching-skill');
  await page.getByRole('button', { name: /^Notifications,/ }).click();
  await page.getByRole('button', { name: 'Mark all read' }).click();
  // Reading every notice leaves the durable Skills update count in place.
  await page.keyboard.press('Escape');
  await page.locator('.notification-panel').waitFor({ state: 'hidden' });
  expect(await skillsUpdateCount(page)).toBe(1);
  await page.getByRole('button', { name: /^Notifications/ }).click();
  await page
    .getByRole('link')
    .filter({ hasText: 'evidence-checklist has an upstream update' })
    .click();
  const review = page.getByRole('dialog', { name: 'Review skill update' });
  await review.waitFor();
  await review.getByRole('button', { name: 'Use this update', exact: true }).waitFor();
  expect(await review.textContent()).toContain('including any local edits');
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await review.waitFor({ state: 'hidden' });
  await page.goForward({ waitUntil: 'domcontentloaded' });
  await review.getByRole('button', { name: 'Use this update', exact: true }).waitFor();
  await review.getByRole('button', { name: 'Keep mine', exact: true }).click();
  await expect.poll(async () => host.daemon.service.skills()[0].content).toBe(input.content);
  await expect.poll(() => skillsUpdateCount(page)).toBe(0);
  expect(await page.getByText('Dismissed version', { exact: false }).count()).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Check now', exact: true }).click();
  await page.getByRole('button', { name: 'Check now', exact: true }).waitFor();
  expect(await skillsUpdateCount(page)).toBe(0);
  revision = 'c';
  await page.getByRole('button', { name: 'Check now', exact: true }).click();
  await expect.poll(() => skillsUpdateCount(page)).toBe(1);
  await page.getByRole('button', { name: 'Updates only', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('updates')).toBe('true');
  await page.getByRole('button', { name: 'Review evidence-checklist update', exact: true }).click();
  await review.getByRole('button', { name: 'Use this update', exact: true }).click();
  await expect.poll(() => skillsUpdateCount(page)).toBe(0);
  expect(host.daemon.service.skills()[0]).toMatchObject({
    content: 'Fictional upstream revision c.',
    roleIds: ['reviewer'],
  });
  // Keep Skills mounted while Crew loads so shared button labels cannot hide a navigation race.
  let crewLoadDelayed = false;
  await page.route(
    '**/assets/CrewPage-*.js',
    async (route) => {
      crewLoadDelayed = true;
      await new Promise((resolve) => setTimeout(resolve, 750));
      await route.continue();
    },
    { times: 1 },
  );
  await page.getByRole('link', { name: /^Crew, 1 update/ }).click();
  await page
    .getByRole('region', { name: /^Waiting on you/ })
    .getByRole('button', { name: 'Updates only', exact: true })
    .click();
  expect(crewLoadDelayed).toBe(true);
  await expect.poll(() => page.locator('.crew-card').count()).toBe(1);
  await page.getByRole('button', { name: 'Compare Scout’s instructions', exact: true }).click();
  await page.locator('.instruction-update').waitFor();
  expect((await page.locator('.instruction-update').boundingBox())!.y).toBeLessThan(300);
  await page.getByRole('button', { name: 'Keep mine', exact: true }).click();
  await page.getByRole('button', { name: 'Close agent settings', exact: true }).click();
  await page.getByRole('link', { name: 'Crew', exact: true }).waitFor();
  // A kept version stays open for comparison under its own disclosure.
  const kept = page
    .getByRole('region', { name: 'Dismissed instruction updates', exact: true })
    .getByRole('button', { name: /^Kept your instructions/ });
  await kept.click();
  expect(await kept.getAttribute('aria-expanded')).toBe('true');
  await page.getByRole('button', { name: 'Compare Scout’s instructions', exact: true }).click();
  await page.getByRole('button', { name: 'Close agent settings', exact: true }).click();
  await page.getByRole('button', { name: 'Compare Scout’s instructions', exact: true }).click();
  await page.getByRole('button', { name: 'Close agent settings', exact: true }).waitFor();
  expect(errors).toEqual([]);
}, 30000);

test('collapsed and mobile sidebars retain the update reminder and a direct review remains usable', async () => {
  // Away from Skills, the collapsed rail keeps the reminder as a dot on More.
  await page.getByRole('link', { name: 'Board', exact: true }).click();
  await page.getByRole('button', { name: 'Hide sidebar', exact: true }).click();
  const more = page.locator('[data-collapsible="icon"]').getByRole('button', {
    name: 'More pages, 1 skill update',
    exact: true,
  });
  const indicator = more.locator('.sidebar-more-dot');
  await indicator.waitFor();
  expect(await indicator.evaluate((element) => getComputedStyle(element).display)).toBe('block');
  expect(await skillsUpdateCount(page)).toBe(1);
  await page.getByRole('button', { name: 'Show sidebar', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('button', { name: 'More pages, 1 skill update', exact: true }).waitFor();
  expect(await skillsUpdateCount(page)).toBe(1);
  await page.keyboard.press('Escape');
  await page.goto(`${host.daemon.url}/skills?skill=${skill.id}&review=true`, {
    waitUntil: 'domcontentloaded',
  });
  const review = page.getByRole('dialog', { name: 'Review skill update' });
  await review.getByRole('button', { name: 'Use this update', exact: true }).waitFor();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
}, 30000);

test('automatic-check preferences persist and failed manual checks retain the reminder', async () => {
  await page.goto(`${host.daemon.url}/settings?section=updates`, { waitUntil: 'domcontentloaded' });
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
  await expect.poll(() => skillsUpdateCount(page)).toBe(1);
  await page.getByText('Couldn’t check:', { exact: false }).waitFor();
  expect(await page.getByText('Last successful check', { exact: false }).count()).toBeGreaterThan(
    0,
  );
  expect(errors).toEqual([]);
}, 30000);
