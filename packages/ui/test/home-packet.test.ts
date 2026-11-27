import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { Approval, Card, Run } from '@pitchcrew/core';
import { cleanup, confirmFixtureApplication, finish, setup } from './helpers/daemon.ts';

// Reviewed packets decided on Home with Decisions' own body and footer: approving moves one in
// place (and, dated by the approval, past its tier's third row, whose fold then opens), and Not
// applying, confirmed in its dialog, leaves a record line and hands focus back to the desk rather
// than to the last element Base UI finds on the page.
let host: Awaited<ReturnType<typeof setup>>;
let browser: Browser;
let page: Page;
let card: Card;
let approval: Approval;
let dogwood: { job: Card; requested: Approval };
const problems: string[] = [];

/** A job whose packet Writer drafted and Reviewer agreed, with its export approval requested. */
const reviewedPacket = async (company: string, slug: string) => {
  const { result: job } = await host.request<Card>('/cards', 'POST', {
    company,
    title: 'React Engineer',
    description: 'Build React interfaces.',
    url: `https://example.com/${slug}`,
  });
  await confirmFixtureApplication(host.request, job.id);
  await host.request(`/cards/${job.id}/move`, 'POST', { state: 'shortlisted' });
  for (const roleId of ['writer', 'reviewer']) {
    const { result: run } = await host.request<Run>(`/cards/${job.id}/run`, 'POST', { roleId });
    await finish(host.request, run.id);
  }
  const { result: requested } = await host.request<Approval>(`/cards/${job.id}/approval`, 'POST', {
    formats: ['pdf', 'docx'],
  });
  return { job, requested };
};

beforeAll(async () => {
  host = await setup();
  await host.request('/profile', 'PUT', {
    name: 'profile.md',
    content: '# Example Candidate\n\n- Built React interfaces.\n',
  });
  // Juniper's packet is the oldest, so it ranks first and opens; three more fill its tier.
  ({ job: card, requested: approval } = await reviewedPacket(
    'Juniper Fixture',
    'fictional-application',
  ));
  for (const company of ['Birch Fixture', 'Cedar Fixture'])
    await reviewedPacket(company, `fictional-${company.split(' ')[0]!.toLowerCase()}`);
  dogwood = await reviewedPacket('Dogwood Fixture', 'fictional-dogwood');
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(15000);
  page.on('pageerror', (error) => problems.push(error.message));
  await page.goto(host.daemon.url);
  await page.getByRole('button', { name: 'Set up later', exact: true }).click();
  await page.locator('.needs-tray').waitFor({ timeout: 30000 });
}, 120000);
afterAll(async () => {
  await browser?.close();
  await cleanup();
}, 30000);

const key = () => `packet:${approval.id}`;
const row = () => page.locator(`[data-needs-key="${key()}"]`);

test('opens the packet with its evidence; approving moves it in place, with no record', async () => {
  expect(await row().getAttribute('data-open')).toBe('');
  expect(await row().locator('.needs-kind').textContent()).toBe('Packet to approve');
  expect(await page.locator('.needs-tier[data-tier="3"] .needs-folded').textContent()).toContain(
    '1 more · packet',
  );
  await row().getByText('Exactly what you’re approving').waitFor();
  // Who agreed reads as provenance, not as the evidence's last line: Reviewer's pebble, under a
  // hairline that sets it apart from the evidence above.
  const who = row().locator('.needs-who');
  expect(await who.textContent()).toMatch(/^Reviewer agreed at /);
  expect(await who.locator('.role-avatar.reviewer').count()).toBe(1);
  expect(await who.evaluate((line) => getComputedStyle(line).borderTopWidth)).toBe('1px');
  await page.waitForTimeout(850);
  await row().getByRole('button', { name: 'Approve packet', exact: true }).click();
  await expect.poll(() => row().locator('.needs-kind').textContent()).toBe('Choose how to apply');
  expect(await row().getAttribute('data-open')).toBe('');
  expect(await page.locator('.needs-row[data-record]').count()).toBe(0);
  // Dated by the approval now, it ranks last in its tier, past the third row: the fold it moved
  // behind opens, so the row stays in view and its trigger keeps focus.
  await expect
    .poll(() =>
      page.locator('.needs-tier[data-tier="3"] .needs-folded').getAttribute('data-panel-open'),
    )
    .toBe('');
  await expect.poll(() => row().locator('.needs-trigger').isVisible()).toBe(true);
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-needs-trigger')))
    .toBe(key());
  // The evidence stays at hand behind Show packet once the choice is the user's move.
  await row().getByRole('button', { name: 'Show packet', exact: true }).waitFor();
  expect(host.daemon.service.board.get<Approval>('approval', approval.id).status).toBe('approved');
});

test('confirms Not applying in its dialog, records it and gives focus back to the desk', async () => {
  await row().getByRole('button', { name: 'More packet actions' }).click();
  await page.getByRole('menuitem', { name: 'Not applying', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Not applying to this job?' });
  await dialog.getByRole('button', { name: 'Mark withdrawn', exact: true }).click();
  const record = page.locator('.needs-row[data-record]').filter({ hasText: 'Juniper Fixture' });
  await record.waitFor();
  expect(await record.textContent()).toContain(
    'Marked withdrawn · nothing is sent to Juniper Fixture',
  );
  await dialog.waitFor({ state: 'detached' });
  // The next row's trigger, that row now open, or with nothing left the close line; never a
  // sidebar link.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const active = document.activeElement;
        if (!active?.closest('.needs-tray')) return false;
        if (active.hasAttribute('data-needs-end')) return true;
        return (
          active.hasAttribute('data-needs-trigger') &&
          active.closest('.needs-row')?.hasAttribute('data-open') === true
        );
      }),
    )
    .toBe(true);
  expect(host.daemon.service.board.get<Card>('card', card.id).state).toBe('withdrawn');
  expect(problems).toEqual([]);
});

test('sends job details’ packet step to the packet’s row on Home, not to Decisions', async () => {
  await page.goto(`${host.daemon.url}/pipeline`);
  await page.locator(`#board-job-${dogwood.job.id} .clay-job-card`).click();
  const sheet = page.locator('.card-details-panel');
  await sheet.waitFor();
  await sheet.getByText('Approve the exact files on Home', { exact: true }).waitFor();
  // ⌘/Ctrl+1–4 leave the page under an open sheet alone.
  await page.keyboard.press('ControlOrMeta+3');
  await page.waitForTimeout(200);
  expect(new URL(page.url()).pathname).toBe('/pipeline');
  expect(await sheet.isVisible()).toBe(true);
  await sheet.getByRole('button', { name: 'Open on Home', exact: true }).first().click();
  await sheet.waitFor({ state: 'detached' });
  // Dogwood ranks last in its tier, so its fold opens to show the row, which takes focus.
  const dogwoodRow = page.locator(`[data-needs-key="packet:${dogwood.requested.id}"]`);
  await expect.poll(() => dogwoodRow.getAttribute('data-open')).toBe('');
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.activeElement?.closest('[data-needs-key]')?.getAttribute('data-needs-key'),
      ),
    )
    .toBe(`packet:${dogwood.requested.id}`);
  expect(new URL(page.url()).pathname).toBe('/');
  expect(new URL(page.url()).search).toBe('');
  expect(problems).toEqual([]);
});
