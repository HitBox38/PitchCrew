import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'vitest';
import type { RemoteMcpInfo, RemoteMcpRequest } from '@pitchcrew/core';
import { cleanup, setup } from './helpers/daemon.ts';

let host: Awaited<ReturnType<typeof setup>>;
let browser: Browser;
let page: Page;
let state: RemoteMcpInfo;
let lostDecision = false;
let failReads = false;
const decisions: { approved: boolean; write: boolean }[] = [];
let stops = 0;
const request: RemoteMcpRequest = {
  id: '886f57e0-3569-4c37-b420-5ae1ee598ea4',
  name: 'Fictional Grok connection',
  code: 'ABCD12',
  redirectHost: 'callback.example.test',
  scopes: ['pitchcrew:read', 'pitchcrew:write'],
  createdAt: '2026-11-10T12:00:00.000Z',
  expiresAt: '2026-11-10T12:10:00.000Z',
};

beforeAll(async () => {
  host = await setup(false, { dev: false });
  host.daemon.service.onboarding.save({ version: 1, status: 'dismissed', step: 0 });
  browser = await chromium.launch({ headless: true });
}, 60000);

beforeEach(async () => {
  decisions.length = 0;
  stops = 0;
  lostDecision = false;
  failReads = false;
  state = { state: 'off', url: null, error: '', tunnelAvailable: true, requests: [], clients: [] };
  page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(10000);
  await page.route('**/api/remote-mcp**', async (route) => {
    const action = new URL(route.request().url()).pathname.replace('/api/remote-mcp', '');
    const method = route.request().method();
    if (method === 'GET' && failReads)
      return route.fulfill({ status: 503, json: { error: 'Fixture read failed' } });
    if (method === 'POST' && action === '/start') state = { ...state, state: 'starting' };
    if (method === 'POST' && action === '/stop') {
      stops += 1;
      state = { ...state, state: 'off', url: null, clients: [], requests: [] };
    }
    if (method === 'POST' && action.endsWith('/decision')) {
      const decision = route.request().postDataJSON() as { approved: boolean; write: boolean };
      decisions.push(decision);
      const decided = state.requests.find((item) => action.includes(item.id))!;
      state = {
        ...state,
        requests: state.requests.filter((item) => item.id !== decided.id),
        clients: decision.approved
          ? [
              ...state.clients,
              {
                id: decided.id,
                name: decided.name,
                write: decision.write,
                createdAt: decided.createdAt,
                expiresAt: '2026-12-10T12:00:00.000Z',
              },
            ]
          : state.clients,
      };
      if (lostDecision) return route.abort('failed');
    }
    if (method === 'DELETE') state = { ...state, clients: [] };
    return route.fulfill({ json: state });
  });
  await page.goto(`${host.daemon.url}/settings?section=accounts`, {
    waitUntil: 'domcontentloaded',
  });
  await page.getByRole('heading', { name: 'Grok Bot and remote apps', exact: true }).waitFor();
});

afterEach(async () => page?.close());
afterAll(async () => {
  await browser?.close();
  await cleanup();
});

test('temporary setup waits for local read-only consent and retains acknowledged state after a failed refresh', async () => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Start temporary connection', exact: true }).click();
  const stop = page.getByRole('button', { name: 'Stop remote connection', exact: true });
  await expect.poll(() => stop.isEnabled()).toBe(true);
  await page.locator('.remote-mcp-connection output.settings-callout').waitFor();
  state = {
    ...state,
    state: 'ready',
    url: 'https://fixture.trycloudflare.com/mcp',
    requests: [request],
  };
  await page.getByRole('button', { name: 'Copy message', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'Add the MCP server https://fixture.trycloudflare.com/mcp and connect it.',
  );
  const permission = page.getByRole('checkbox', {
    name: 'Allow changes and crew messages',
    exact: true,
  });
  await permission.waitFor();
  expect(await permission.isChecked()).toBe(false);
  expect(await permission.getAttribute('aria-describedby')).toBe(
    `remote-write-description-${request.id}`,
  );
  expect(decisions).toEqual([]);
  await page.getByText('ABCD12', { exact: true }).waitFor();
  await page.getByText('1 request waiting', { exact: true }).waitFor();
  const requestBox = await page.locator('.remote-mcp-requests').boundingBox();
  const setupBox = await page.locator('.remote-mcp-steps').boundingBox();
  expect(requestBox!.y).toBeLessThan(setupBox!.y);
  await page
    .locator('.remote-mcp-connection output.settings-callout')
    .waitFor({ state: 'detached' });
  await stop.click();
  const confirmation = page.getByRole('dialog', {
    name: 'Stop and cancel pending connections?',
    exact: true,
  });
  await confirmation.waitFor();
  expect(stops).toBe(0);
  await confirmation.getByRole('button', { name: 'Keep connection', exact: true }).click();
  await expect
    .poll(() => stop.evaluate((element) => element === document.activeElement))
    .toBe(true);

  failReads = true;
  await page.getByRole('button', { name: 'Approve read-only', exact: true }).click();
  await page.getByText('Authorized, no requests yet', { exact: true }).waitFor();
  await expect
    .poll(() =>
      page
        .locator('#remote-request-heading')
        .evaluate((element) => element === document.activeElement),
    )
    .toBe(true);
  await page
    .getByRole('alert')
    .filter({ hasText: 'Could not refresh remote connections' })
    .waitFor();
  expect(decisions).toEqual([{ approved: true, write: false }]);
  await page
    .getByText('Approved. Waiting for the app to finish connecting; it will appear below.', {
      exact: true,
    })
    .waitFor();
  failReads = false;
  state = {
    ...state,
    clients: state.clients.map((client) => ({ ...client, lastUsedAt: '2026-11-10T12:01:00.000Z' })),
  };
  await page.getByRole('button', { name: 'Check status', exact: true }).click();
  await page.getByText(/^Last successful request /).waitFor();
  await page.getByRole('button', { name: `Disconnect ${request.name}`, exact: true }).click();
  await page
    .getByText('Apps appear here after they finish connecting.', {
      exact: true,
    })
    .waitFor();
  await expect
    .poll(() =>
      page
        .locator('#remote-clients-heading')
        .evaluate((element) => element === document.activeElement),
    )
    .toBe(true);
  await stop.click();
  await page.getByRole('button', { name: 'Start temporary connection', exact: true }).waitFor();
}, 30000);

test('an uncertain consent response requires a read before any repeated change', async () => {
  state = {
    ...state,
    state: 'ready',
    url: 'https://fixture.trycloudflare.com/mcp',
    requests: [request],
  };
  await page.getByRole('button', { name: 'Check status', exact: true }).click();
  await page
    .getByRole('checkbox', { name: 'Allow changes and crew messages', exact: true })
    .click();
  lostDecision = true;
  const approve = page.getByRole('button', { name: 'Approve with changes', exact: true });
  await approve.click();
  await page
    .getByRole('alert')
    .filter({ hasText: 'Check status before trying another change' })
    .waitFor();
  expect(await approve.isDisabled()).toBe(true);
  await expect
    .poll(() =>
      page.locator('#remote-mcp-check').evaluate((element) => element === document.activeElement),
    )
    .toBe(true);
  expect(decisions).toEqual([{ approved: true, write: true }]);
  await page.getByRole('button', { name: 'Check status', exact: true }).click();
  await page.getByText('Authorized, no requests yet', { exact: true }).waitFor();
  expect(await approve.count()).toBe(0);
  expect(decisions).toHaveLength(1);
  await page.getByRole('button', { name: 'Stop remote connection', exact: true }).click();
  const confirmation = page.getByRole('dialog', {
    name: 'Stop and disconnect 1 app?',
    exact: true,
  });
  await confirmation.waitFor();
  expect(stops).toBe(0);
  await confirmation.getByRole('button', { name: 'Stop and disconnect', exact: true }).click();
  await page.getByRole('button', { name: 'Start temporary connection', exact: true }).waitFor();
  expect(stops).toBe(1);
}, 30000);

test('foreground keyboard approval preserves focus when a second request remains', async () => {
  const second = {
    ...request,
    id: '63513adc-4876-4de8-bd44-11de10a27c93',
    name: 'Second fixture app',
    code: 'EFGH34',
  };
  state = {
    ...state,
    state: 'ready',
    url: 'https://fixture.trycloudflare.com/mcp',
    requests: [request, second],
  };
  await page.getByRole('button', { name: 'Check status', exact: true }).click();
  await page.bringToFront();
  const approve = page
    .locator(`[aria-labelledby="remote-request-${request.id}"]`)
    .getByRole('button', { name: 'Approve read-only', exact: true });
  await approve.focus();
  expect(await page.evaluate(() => document.visibilityState)).toBe('visible');
  expect(await page.evaluate(() => document.hasFocus())).toBe(true);
  await page.keyboard.press('Enter');
  await page.locator(`[aria-labelledby="remote-request-${second.id}"]`).waitFor();
  await expect
    .poll(() =>
      page
        .locator('#remote-request-heading')
        .evaluate((element) => element === document.activeElement),
    )
    .toBe(true);
  expect(state.requests.map((item) => item.id)).toEqual([second.id]);
  expect(decisions).toEqual([{ approved: true, write: false }]);
}, 30000);
