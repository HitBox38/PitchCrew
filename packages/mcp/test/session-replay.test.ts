import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { stripTypeScriptTypes } from 'node:module';
import { expect, it } from 'vitest';

it('ships useful wireframe snapshots and pointer interactions without private DOM data or side effects', async () => {
  const secret = 'PRIVATE_replay_ada@example.test_Users_resume_Company42';
  const root = new URL('../../ui/src/Analytics/replay/', import.meta.url);
  const compile = (source: string) => stripTypeScriptTypes(source);
  const privacy = compile(await readFile(new URL('privacy.ts', root), 'utf8'));
  const recorder = compile(await readFile(new URL('recorder.ts', root), 'utf8')).replace(
    "'./privacy'",
    "'/privacy.js'",
  );
  const rrweb = await readFile(
    new URL('../../ui/node_modules/posthog-js/dist/rrweb.js', import.meta.url),
    'utf8',
  );
  const payloads: string[] = [];
  const assets: Record<string, string> = {
    '/privacy.js': privacy,
    '/recorder.js': recorder,
    '/rrweb.js': rrweb,
  };
  const server = createServer((request, response) => {
    if (request.url === '/capture') {
      let body = '';
      request.on('data', (chunk) => {
        body += chunk;
      });
      request.on('end', () => {
        payloads.push(body);
        response.end('ok');
      });
      return;
    }
    if (assets[request.url!]) {
      response.setHeader('content-type', 'text/javascript');
      response.end(assets[request.url!]);
      return;
    }
    response.setHeader('content-type', 'text/html');
    response.end(`<!doctype html><title>${secret}</title><style>body{margin:0}nav{width:220px;height:600px}a{display:block;width:180px;height:42px}main{position:absolute;left:230px;top:0;width:600px;height:600px}</style>
      <nav><a id="nav" data-replay-surface="board" href="/?${secret}" aria-label="${secret}" title="${secret}">Board ${secret}</a></nav>
      <main><section id="${secret}" data-company="${secret}">${secret}<input type="hidden" value="${secret}"><input type="file" aria-label="${secret}"><img src="/${secret}"></section></main>
      <script type="module">
      import {record, Replayer} from '/rrweb.js'; window.Replayer=Replayer; import {createReplay} from '/recorder.js'; import {sanitizeReplayProperties} from '/privacy.js';
      window.allowed=true; window.replay=createReplay(async()=>({record,node:id=>record.mirror.getNode(id)}),()=>window.allowed,
        events=>fetch('/capture',{method:'POST',body:JSON.stringify(sanitizeReplayProperties({$snapshot_data:events,$session_id:'fixture-session',$window_id:'fixture-window'}))}));
      document.querySelector('#nav').addEventListener('click',e=>e.preventDefault());
      await window.replay.setEnabled(true); window.ready=true;
      </script>`);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test server address');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${address.port}/`);
    await page.waitForFunction(() => (window as unknown as { ready: boolean }).ready);
    await page.locator('#nav').click();
    await page.evaluate((secret) => {
      const nav = document.querySelector('#nav')!;
      nav.setAttribute('aria-label', secret + '_mutated');
      nav.setAttribute('href', '/Users/' + secret);
      nav.textContent = secret + '_mutated';
      const added = document.createElement('div');
      added.id = secret;
      added.setAttribute('data-attachment-path', secret);
      added.textContent = secret;
      document.body.appendChild(added);
      const browser = document.createElement('aside');
      browser.id = 'agent-browser-panel';
      browser.innerHTML = `<img src="/${secret}"><p>${secret}</p>`;
      document.body.appendChild(browser);
      const sheet = document.createElement('div');
      sheet.setAttribute('role', 'dialog');
      sheet.innerHTML = `<input value="${secret}"><p>${secret}</p>`;
      document.body.appendChild(sheet);
    }, secret);
    await expect.poll(() => payloads.length, { timeout: 7000 }).toBeGreaterThan(0);
    const serialized = payloads.join('\n');
    expect(serialized).not.toContain(secret);
    for (const field of ['aria-label', 'href":"/Users', 'data-attachment-path', 'data-company'])
      expect(serialized).not.toContain(field);
    const events = payloads.flatMap((payload) => JSON.parse(payload).$snapshot_data);
    expect(events.some((event) => event.type === 2)).toBe(true);
    expect(events.some((event) => event.type === 3 && event.data.source === 0)).toBe(true);
    expect(events.some((event) => event.type === 3 && event.data.source === 2)).toBe(true);
    expect(serialized).toContain('data-replay-surface');
    expect(serialized).toContain('width:180px');
    expect(await page.locator('#nav').getAttribute('aria-label')).toBe(secret + '_mutated');
    expect(await page.locator('#nav').textContent()).toBe(secret + '_mutated');
    await page.evaluate(() => {
      const state = window as unknown as { allowed: boolean; replay: { stop(): void } };
      state.allowed = false;
      state.replay.stop();
    });
    const count = payloads.length;
    await page.locator('#nav').click();
    await page.waitForTimeout(5100);
    expect(payloads).toHaveLength(count);
    // Verify native rrweb can replay our rebuilt event schema and wireframe dimensions.
    await page.evaluate(async (events) => {
      const { Replayer } = window as unknown as {
        Replayer: new (
          events: unknown[],
          options: Record<string, unknown>,
        ) => { pause(time: number): void };
      };
      const root = document.createElement('div');
      root.id = 'replay-verification';
      document.body.appendChild(root);
      const replayer = new Replayer(events, { root, showWarning: false, showDebug: false });
      replayer.pause(0);
      (window as unknown as { replayer: unknown }).replayer = replayer;
    }, events);
    const replayFrame = page.frameLocator('#replay-verification iframe');
    await expect
      .poll(async () => replayFrame.locator('[data-replay-surface="board"]').count())
      .toBe(1);
    expect(
      await replayFrame
        .locator('[data-replay-surface="board"]')
        .evaluate((node) => node.getBoundingClientRect().width),
    ).toBe(180);
    expect(await replayFrame.locator('body').textContent()).not.toContain(secret);
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}, 20000);
