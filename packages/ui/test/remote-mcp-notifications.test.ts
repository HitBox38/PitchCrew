import type { RemoteMcpInfo } from '@pitchcrew/core';
import { chromium, type Browser, type Page, type Route } from 'playwright';
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { cleanup, setup } from './helpers/daemon.ts';

let host: Awaited<ReturnType<typeof setup>>;
let browser: Browser;
let page: Page;

beforeAll(async () => {
  host = await setup(false, { dev: false });
  host.daemon.service.onboarding.save({ version: 1, status: 'dismissed', step: 0 });
  browser = await chromium.launch({ headless: true });
}, 60000);

afterEach(async () => page?.close());
afterAll(async () => {
  await browser?.close();
  await cleanup();
});

const connectionState = (): RemoteMcpInfo => ({
  state: 'ready',
  url: 'https://fixture.trycloudflare.com/mcp',
  error: '',
  tunnelAvailable: true,
  clients: [],
  requests: [
    {
      id: '886f57e0-3569-4c37-b420-5ae1ee598ea4',
      name: 'Fictional remote app',
      code: 'ABCD-1234',
      redirectHost: 'example.test',
      scopes: ['pitchcrew:read', 'pitchcrew:write'],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    },
  ],
});

test('a remote request appears outside Settings and opens the exact review section without approving', async () => {
  const state = connectionState();
  let reads = 0;
  page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(10000);
  await page.route('**/api/remote-mcp**', async (route) => {
    expect(route.request().method()).toBe('GET');
    reads++;
    await route.fulfill({ json: state });
  });
  await page.goto(host.daemon.url, { waitUntil: 'domcontentloaded' });
  const bell = page.getByRole('button', { name: 'Notifications, 1 unread', exact: true });
  await bell.waitFor();
  expect(reads).toBe(1);
  await bell.click();
  await page.locator('#notification-group-needs').waitFor();
  const notice = page.getByRole('link', { name: /Fictional remote app wants to connect/ });
  expect(await notice.getAttribute('href')).toBe('/settings?section=accounts#remote-mcp-heading');
  await notice.click();
  await page.locator('#remote-mcp-heading').waitFor();
  expect(new URL(page.url()).hash).toBe('#remote-mcp-heading');
  expect(new URL(page.url()).searchParams.get('section')).toBe('accounts');
  await page.getByText('ABCD-1234', { exact: true }).waitFor();
  state.requests = [];
  await expect
    .poll(
      () => page.getByRole('button', { name: 'Notifications, 0 unread', exact: true }).count(),
      {
        timeout: 10000,
      },
    )
    .toBe(1);
  await expect.poll(() => page.locator('.remote-mcp-request').count(), { timeout: 10000 }).toBe(0);
  await page.getByRole('button', { name: 'Notifications, 0 unread', exact: true }).click();
  await expect
    .poll(() => page.locator('.notification-context[data-context="remote_connection"]').count(), {
      timeout: 10000,
    })
    .toBe(0);
}, 20000);

test('a stalled remote notice read times out and a later poll discovers the request', async () => {
  const state = connectionState();
  let reads = 0;
  let stalled: Route | undefined;
  page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const timeout = AbortSignal.timeout.bind(AbortSignal);
    // Keep the production deadline path, with a short test-only duration.
    AbortSignal.timeout = (milliseconds) => timeout(milliseconds === 10000 ? 500 : milliseconds);
  });
  await page.route('**/api/remote-mcp', async (route) => {
    expect(route.request().method()).toBe('GET');
    reads++;
    if (reads === 1) {
      stalled = route;
      return;
    }
    await route.fulfill({ json: state });
  });
  await page.goto(host.daemon.url, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Notifications, 1 unread', exact: true }).waitFor();
  expect(reads).toBe(2);
  await stalled?.abort().catch(() => {});
}, 20000);
