import { randomUUID } from 'node:crypto';
import { chromium, type Browser, type Page, type Route } from 'playwright';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { ComputerApproval, Snapshot, TrackingSignal, WorkQueue } from '@pitchcrew/core';
import { ordinal } from '../src/lib/text.ts';
import { cleanup, confirmFixtureApplication, setup } from './helpers/daemon.ts';
import {
  failFit,
  queueMoreFits,
  seedAttention,
  type AttentionFixture,
} from './fixtures/attention.ts';

// Home on the shared attention cast: one count, the open row, deciding each seeded kind in place,
// the decide shortcut and its field rules, `?item=`, row keys, the click guard and focus; the crew
// rail at 1440 and 1024, Since you were last here, and the phone at 390. Checks that leave the
// board as they found it run first (the keys check adds three tracking reviews and rejects them
// again); the rest change it in order.
let host: Awaited<ReturnType<typeof setup>>;
let fixture: AttentionFixture;
let browser: Browser;
let page: Page;
const problems: string[] = [];
const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
const decisions: string[] = [];
/** Page errors and Base UI warnings fail the file, from every page it opens. */
const watch = (opened: Page) => {
  opened.setDefaultTimeout(15000);
  opened.on('pageerror', (error) => problems.push(error.message));
  opened.on('console', (message) => {
    if (message.text().includes('Base UI')) problems.push(message.text());
  });
  return opened;
};

beforeAll(async () => {
  host = await setup();
  fixture = await seedAttention(host.daemon.service);
  browser = await chromium.launch({ headless: true });
  page = watch(
    await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }),
  );
  // Every decision a desk verb could send: approvals, answers, recovery, tracking, proposals.
  page.on('request', (request) => {
    if (['POST', 'PUT'].includes(request.method()) && request.url().includes('/api/'))
      decisions.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });
  await page.goto(host.daemon.url);
  await page.locator('.needs-tray').waitFor({ timeout: 30000 });
}, 90000);
afterAll(async () => {
  await browser?.close();
  await cleanup();
}, 60000);

const keys = () => ({
  browser: `browser:${fixture.approvalId}`,
  question: `question:${fixture.questionId}`,
  failure: `failure:${fixture.failedQueueId}`,
  tracking: `tracking:${fixture.signalId}`,
  brief: `brief:${fixture.cards.quill}`,
  proposal: `role-proposal:${fixture.proposalId}`,
});
const row = (key: string) => page.locator(`[data-needs-key="${key}"]`);
const trigger = (key: string) => page.locator(`[data-needs-trigger="${key}"]`);
/** Opens a row unless the desk already has it open (its trigger toggles). */
const openRow = async (key: string) => {
  if ((await row(key).getAttribute('data-open')) === null) await trigger(key).click();
};
const record = (subject: string) =>
  page.locator('.needs-row[data-record]').filter({ hasText: subject });
const focused = () =>
  page.evaluate(() => document.activeElement?.getAttribute('data-needs-trigger') ?? null);
const snapshot = async () => (await host.request<Snapshot>('/snapshot?view=workspace')).result;
/** The Home badge, title fact and heading chip, which always agree. */
const expectCount = async (count: number) => {
  await page.getByRole('link', { name: `Home, ${count} waiting on you`, exact: true }).waitFor();
  expect(await page.locator('.home-fact').textContent()).toMatch(
    new RegExp(`^${count} needs? you`),
  );
  expect(await page.locator('.needs-count').textContent()).toBe(String(count));
};
/**
 * Where each of these parts of an open row sits, in page coordinates: every row reads headline,
 * evidence, who asked, what waits, the verbs (the glazed one first, at the left), then what deciding
 * does under them.
 */
const boxesIn = async (scope: ReturnType<Page['locator']>, selectors: string[]) =>
  Promise.all(
    selectors.map(async (selector) => (await scope.locator(selector).first().boundingBox())!),
  );
/** The press guard swallows a click within 800 ms of a decision; pointer tests wait past it. */
const pastGuard = () => page.waitForTimeout(850);
/** A pending, non-submission browser request on a live run, recorded as an agent would. */
const askBrowser = (runId: string, roleId: string, cardId: string, label: string) => {
  const approval: ComputerApproval = {
    id: randomUUID(),
    runId,
    roleId,
    cardId,
    action: { kind: 'click', selector: '#more' },
    reason: `Open ${label} on the fictional posting`,
    page: {
      url: 'https://example.com/posting',
      title: 'Posting (fictional)',
      text: 'Fictional posting.',
      screenshot: '',
      digest: `page-${label}`,
      controls: [
        {
          selector: '#more',
          label,
          type: 'button',
          required: false,
          visible: true,
          disabled: false,
          accept: '',
          options: [],
        },
      ],
    },
    digest: `action-${label}`,
    status: 'pending',
    error: '',
    createdAt: new Date().toISOString(),
    decidedAt: null,
  };
  host.daemon.service.board.record('computer_approval', approval, roleId, 'Fixture request');
  return approval;
};

test('shows one count in the badge, the title fact and the heading; Decisions keeps its own', async () => {
  await expectCount(6);
  await page.goto(`${host.daemon.url}/inbox`);
  expect(await page.locator('.decide-position').textContent()).toBe('1 of 3');
  await page.goto(host.daemon.url);
  await page.locator('.needs-tray').waitFor();
});

test('opens the Initech submission first, with its page and end, and ranks the tiers', async () => {
  const open = page.locator('.needs-row[data-open]');
  expect(await open.getAttribute('data-needs-key')).toBe(keys().browser);
  const approve = open.getByRole('button', { name: 'Approve submission', exact: true });
  // A final submission never takes the decide shortcut.
  expect(await approve.getAttribute('aria-keyshortcuts')).toBeNull();
  expect(await approve.locator('[data-slot="kbd"]').count()).toBe(0);
  await open.getByRole('button', { name: 'Reject', exact: true }).waitFor();
  await open.getByRole('button', { name: 'Details', exact: true }).waitFor();
  await open.getByRole('button', { name: 'Enlarge the captured page' }).waitFor();
  expect(await open.locator('.needs-blocks time').textContent()).toMatch(/^about \d/);
  // The panel clips to its own moving edge, so an opening row never draws over the rows below.
  expect(
    await open.locator('.needs-panel').evaluate((panel) => getComputedStyle(panel).overflowY),
  ).toBe('clip');
  expect(await page.locator('.needs-tier-caption').allTextContents()).toEqual([
    'Ends soon or stops the crew',
    'Queued work waits on you',
    'Your move on a job',
    'A record to confirm',
    'Changes nothing until you adopt it',
  ]);
  expect(await row(keys().failure).getAttribute('data-tone')).toBe('rose');
  expect(await row(keys().failure).locator('.needs-kind').textContent()).toBe('Failed request');
});

test('brings a tier’s first row into view by its caption, never cutting a caption', async () => {
  // A short window, so every tier's first row can rest where the desk brings it.
  await page.setViewportSize({ width: 1440, height: 420 });
  const scroller = page.locator('.workspace-body');
  const before = await scroller.evaluate((element) => element.scrollTop);
  let checked = 0;
  // Each tier's first row, brought in as the desk brings in a row it opens.
  const firsts = page.locator('.needs-tier-caption + .needs-row');
  for (let index = 1; index < (await firsts.count()); index += 1) {
    const geometry = await firsts.nth(index).evaluate((first) => {
      const body = first.closest('.workspace-body')!;
      body.scrollTop = body.scrollHeight;
      first.scrollIntoView({ block: 'start', behavior: 'instant' });
      const top = body.getBoundingClientRect().top;
      const caption = first.previousElementSibling!.getBoundingClientRect();
      const above = first.closest('.needs-tier')!.previousElementSibling?.getBoundingClientRect();
      return {
        row: Math.round(first.getBoundingClientRect().top - top),
        caption: caption.top - top,
        above: above ? above.bottom - top : 0,
        // Neither end of the scroller held it back.
        free: body.scrollTop > 0 && body.scrollTop < body.scrollHeight - body.clientHeight - 1,
      };
    });
    if (!geometry.free) continue;
    checked += 1;
    expect(geometry.row).toBe(30);
    // Its own caption shows whole, and the group above has left the view.
    expect(geometry.caption).toBeGreaterThanOrEqual(0);
    expect(geometry.above).toBeLessThanOrEqual(0);
  }
  expect(checked).toBeGreaterThan(1);
  await scroller.evaluate((element, top) => (element.scrollTop = top), before);
  await page.setViewportSize({ width: 1440, height: 900 });
});

test('moves between rows with the arrow keys, Home, End, j and k, skipping folded rows', async () => {
  // Three more tracking reviews fold the fourth row of their tier.
  const base = host.daemon.service.board.get<TrackingSignal>('tracking_signal', fixture.signalId);
  const extra = [1, 2, 3].map((index) => {
    const signal = {
      ...base,
      id: randomUUID(),
      messageId: `fixture-message-${index}`,
      createdAt: new Date(Date.now() - (10 - index) * 60_000).toISOString(),
    };
    host.daemon.service.board.record('tracking_signal', signal, 'tracker', 'Fixture review');
    return `tracking:${signal.id}`;
  });
  await page.locator('.needs-folded').waitFor();
  const order = [
    keys().browser,
    keys().failure,
    keys().question,
    keys().brief,
    keys().tracking,
    extra[0],
    extra[1],
    keys().proposal,
  ];
  await trigger(keys().browser).focus();
  const step = async (key: string, expected: string | undefined) => {
    await page.keyboard.press(key);
    expect(await focused()).toBe(expected);
  };
  await step('ArrowDown', order[1]);
  await step('ArrowUp', order[0]);
  await step('ArrowUp', order.at(-1)); // wraps
  await step('ArrowDown', order[0]);
  await step('End', order.at(-1));
  await step('ArrowUp', order[6]); // the folded review is skipped
  await step('Home', order[0]);
  // j and k from inside the open row's body.
  await row(keys().browser).getByRole('button', { name: 'Details', exact: true }).focus();
  await step('j', order[1]);
  await step('k', order[0]);
  for (const key of extra)
    await host.request(`/tracking/evidence/${key.slice(9)}/decision`, 'POST', { approved: false });
  await expectCount(6);
});

/** The rail's rows: each run's or queue's subject, and its agent line. */
const railRows = (selector: string) =>
  page.getByRole('region', { name: 'Crew at work' }).locator(selector);
/** Controls a phone must be able to hit: every visible link and button but inline prose links. */
const smallTargets = (opened: Page) =>
  opened.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('main a, main button')]
      .filter((element) => element.checkVisibility({ visibilityProperty: true }))
      .filter((element) => !element.closest("[data-streamdown='link'], .chat-reference, p a"))
      .filter((element) => element.getBoundingClientRect().height < 44)
      .map((element) => `${element.tagName} ${element.textContent?.trim().slice(0, 40)}`),
  );

/**
 * What the pinned rail, scrolled to its top, shows only in part at its foot: text lines, avatars
 * and beads crossing its scroll edge (the top of its 12px foot), and a block heading left there
 * without its first row. It must rest on a whole row, under its heading.
 */
const railFootCuts = () =>
  page.evaluate(() => {
    const rail = document.querySelector<HTMLElement>('.home > .home-rail')!;
    rail.scrollTop = 0;
    const edge = rail.getBoundingClientRect().top + rail.clientTop + rail.clientHeight;
    const lines = [
      ...rail.querySelectorAll<HTMLElement>(
        '.home-block-head, .home-run, .home-next, .home-rest-trigger, .home-crew, .home-stage, .home-empty',
      ),
    ].filter((line) => line.getClientRects().length);
    const shown = lines.filter((line) => line.getBoundingClientRect().bottom <= edge + 2);
    const last = shown.at(-1);
    const stranded = !!last?.matches('.home-block-head') && lines.indexOf(last) < lines.length - 1;
    const boxes: DOMRect[] = [];
    const walker = document.createTreeWalker(rail, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent?.trim() || node.parentElement?.closest('.sr-only')) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      boxes.push(...range.getClientRects());
    }
    for (const mark of rail.querySelectorAll('.role-avatar, .clay-bead'))
      boxes.push(mark.getBoundingClientRect());
    const cut = boxes.filter((box) => box.height && box.top < edge - 2 && box.bottom > edge + 2);
    return { scrolls: rail.scrollHeight > rail.clientHeight, cut: cut.length, stranded };
  });

test('shows the crew at work beside the desk, and under it with the strip at 1024', async () => {
  const rail = page.getByRole('region', { name: 'Crew at work' });
  await expect.poll(() => railRows('.home-run').count()).toBe(5);
  expect(await rail.locator('.home-working .home-block-fact').textContent()).toBe(
    '5 of 5 work slots in use',
  );
  // Initech's run holds its slot waiting on the browser approval: still ochre, timed as a wait.
  const initech = railRows('.home-run').filter({ hasText: 'Initech' });
  expect(await initech.locator('.home-row-meta').textContent()).toMatch(/waiting \d+ min$/);
  expect(await initech.locator('.clay-bead').getAttribute('data-tone')).toBe('ochre');
  expect(await initech.locator('.clay-bead').getAttribute('data-live')).toBeNull();
  expect(await railRows('.home-run').filter({ hasText: 'Halcyon' }).textContent()).toContain(
    'Reviewing the packet',
  );
  expect(await railRows('.home-run').filter({ hasText: 'Globex' }).textContent()).toContain(
    'Writer for Reviewer',
  );
  // Up next with every slot busy: three fits for Scout, each with its place in line.
  expect(await railRows('.home-next .home-row-subject').allTextContents()).toEqual([
    'Northwind',
    'Kestrel AI',
    'Tidepool',
  ]);
  const places = await railRows('.home-next .home-row-says').allTextContents();
  expect(places.map((text) => text.replace(/\s+/g, ' '))).toEqual([
    'Scout · , Next in line',
    'Scout · , 2nd in line',
    'Scout · , 3rd in line',
  ]);
  expect(await rail.getByRole('link', { name: /8 agents, 4 working/ }).textContent()).toContain(
    'Writer on 2 jobs',
  );
  expect(await rail.locator('.home-pipeline .home-count').textContent()).toBe('12 open');
  const stages = await rail.locator('.home-stage').allInnerTexts();
  expect(stages.map((text) => text.replace(/\s+/g, ' '))).toEqual([
    'Leads5 not scored 5',
    'Shortlisted 1',
    'In progress 5',
    'Applied 1',
    'Closed 0',
  ]);
  // Home scrolls inside the work area, never the document (screen-reader text included).
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight),
  ).toBe(true);
  // At 1440 the rail sits right of the desk, and the strip steps aside.
  const desk = (await page.locator('.needs').boundingBox())!;
  expect((await rail.boundingBox())!.x).toBeGreaterThanOrEqual(desk.x + desk.width);
  expect(await page.locator('.home-strip').isVisible()).toBe(false);
  // Taller than the view, the pinned rail scrolls on its own, and at rest its foot falls between
  // rows, at every window height: it never slices a line, an avatar or a bead, and never leaves a
  // block's heading without its first row.
  for (const height of [900, 860, 820, 800, 768]) {
    await page.setViewportSize({ width: 1440, height });
    await expect.poll(railFootCuts).toEqual({ scrolls: true, cut: 0, stranded: false });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  // At 1024 the strip answers on the first screen and the rail's blocks sit below the desk.
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.locator('.home-strip').waitFor();
  expect(await page.locator('.home-strip-run').count()).toBe(5);
  const narrow = (await page.locator('.needs').boundingBox())!;
  expect((await rail.boundingBox())!.y).toBeGreaterThanOrEqual(narrow.y + narrow.height);
  expect(
    await page
      .locator('.home-workspace-body')
      .evaluate((body) => body.scrollWidth <= body.clientWidth),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('.home-strip').waitFor({ state: 'hidden' });
});

test('lists what was recorded since this device last showed Home, or the last 24 hours', async () => {
  const back = watch(
    await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }),
  );
  const seen = new Date(Date.now() - 3 * 3_600_000).toISOString();
  await back.addInitScript((value) => localStorage.setItem('pitchcrew-home-seen-v1', value), seen);
  await back.goto(host.daemon.url);
  const since = back.getByRole('region', { name: 'Since you were last here' });
  await since.waitFor();
  expect(await since.locator('.home-block-fact').textContent()).toMatch(/^since \S/);
  expect(await since.locator('.home-block-fact').getAttribute('title')).toBe(
    'Last opened on this device',
  );
  // The heading's summary: the finished review, the six asks that arrived since and still wait,
  // and the five new leads.
  const summary = await back.locator('.home-since-link').textContent();
  expect(summary).toContain('Since you were last here: 1 finished · 6 new asks · 5 new leads');
  await since.getByText('Reviewer reviewed Globex', { exact: true }).waitFor();
  await since.getByText('5 new leads', { exact: true }).waitFor();
  // A new ask's line opens its row in Needs you.
  await since.getByRole('button', { name: /Question from Writer · Umbra Health/ }).click();
  await expect
    .poll(() => back.evaluate(() => document.activeElement?.getAttribute('data-needs-trigger')))
    .toBe(`question:${fixture.questionId}`);
  // The heading's button brings the section into view and focuses its heading, scrolling only the
  // work area: the title row and the document stay put.
  const title = await back.locator('.workspace-title-row').boundingBox();
  await back.locator('.home-since-link').click();
  await expect.poll(() => back.evaluate(() => document.activeElement?.id)).toBe('home-since-title');
  expect(await back.evaluate(() => document.scrollingElement?.scrollTop)).toBe(0);
  expect((await back.locator('.workspace-title-row').boundingBox())?.y).toBe(title?.y);
  await back.close();
  // With nothing stored on this device, the last 24 hours.
  const first = watch(
    await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }),
  );
  await first.goto(host.daemon.url);
  await first
    .getByRole('region', { name: 'Since you were last here' })
    .locator('.home-block-fact', { hasText: 'In the last 24 hours' })
    .waitFor();
  await first.close();
}, 45_000);

test('moves the since mark only while Home is in front: once when the user leaves, never after', async () => {
  const away = watch(
    await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }),
  );
  const before = '2026-11-19T10:00:00.000Z';
  // Visibility and focus are the page's own to report, so the test sets them: Home opens in a
  // hidden, unfocused window, as a background tab the user has not looked at.
  await away.addInitScript((value) => {
    const view = { visible: false, focused: false };
    Object.assign(window, { homeView: view });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (view.visible ? 'visible' : 'hidden'),
    });
    document.hasFocus = () => view.focused;
    localStorage.setItem('pitchcrew-home-seen-v1', value);
  }, before);
  await away.goto(host.daemon.url);
  await away.locator('.needs-tray').waitFor();
  const mark = () => away.evaluate(() => localStorage.getItem('pitchcrew-home-seen-v1'));
  const set = (view: { visible?: boolean; focused?: boolean }) =>
    away.evaluate((next) => {
      Object.assign((window as unknown as { homeView: object }).homeView, next);
    }, view);
  const fire = (type: 'focus' | 'blur' | 'pagehide' | 'visibilitychange') =>
    away.evaluate((name) => {
      (name === 'visibilitychange' ? document : window).dispatchEvent(new Event(name));
    }, type);
  // Mounted while hidden: hiding, unloading or losing focus moves nothing.
  await fire('visibilitychange');
  await fire('blur');
  await fire('pagehide');
  expect(await mark()).toBe(before);
  // In front of the user, then left for another app: the mark moves once, to when they left…
  await set({ visible: true, focused: true });
  await fire('focus');
  await set({ focused: false });
  await fire('blur');
  const left = await mark();
  expect(left).not.toBe(before);
  // …and a later hide or unload of the window they had already left keeps it there, as does
  // leaving Home for another page while away.
  await away.waitForTimeout(30);
  await set({ visible: false });
  await fire('visibilitychange');
  await fire('pagehide');
  await away.getByRole('link', { name: 'Pipeline', exact: true }).click();
  await away.waitForURL(/\/pipeline/);
  expect(await mark()).toBe(left);
  await away.close();
});

test('fits a phone: no sideways scroll, 44px targets, closed sections, each run’s step and what was recorded', async () => {
  const phone = watch(
    await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
      isMobile: true,
      hasTouch: true,
    }),
  );
  await phone.goto(host.daemon.url);
  await phone.locator('.needs-tray').waitFor();
  const sideways = () =>
    phone.evaluate(() => {
      const body = document.querySelector('.home-workspace-body')!;
      return [
        document.documentElement.scrollWidth <= innerWidth,
        body.scrollWidth <= body.clientWidth,
      ];
    });
  expect(await sideways()).toEqual([true, true]);
  expect(await smallTargets(phone)).toEqual([]);
  expect(await phone.locator('.home-fact').isVisible()).toBe(true);
  expect(await phone.locator('.home-strip').isVisible()).toBe(true);
  // A phone shows no tooltip, so each run's step takes a line of its own under the job.
  const strip = (subject: string) => phone.locator('.home-strip-run').filter({ hasText: subject });
  for (const [subject, step] of [
    ['Halcyon', 'Checking claims against your profile'],
    ['Initech', 'Waiting for your OK'],
  ]) {
    const line = strip(subject!).locator('.home-strip-step');
    expect(await line.innerText()).toContain(step);
    const job = (await strip(subject!).locator('.home-strip-subject').boundingBox())!;
    expect((await line.boundingBox())!.y).toBeGreaterThanOrEqual(job.y + job.height - 1);
  }
  // Since, Crew at work and Pipeline start closed.
  const triggers = phone.locator('.home-section-trigger');
  expect(await triggers.allInnerTexts()).toHaveLength(3);
  for (const trigger of await triggers.all())
    expect(await trigger.getAttribute('aria-expanded')).toBe('false');
  // The since button takes its own line under the heading and keeps what was recorded, the
  // closed section's own summary; it opens Since and focuses its trigger.
  const recorded = await triggers.first().locator('.home-section-fact').innerText();
  const since = phone.locator('.home-since-link');
  expect(await since.innerText()).toMatch(/^Since \S/);
  expect((await since.innerText()).endsWith(` · ${recorded}`)).toBe(true);
  const heading = (await phone.locator('#needs-title').boundingBox())!;
  const words = (await since.locator('.home-since-link-short').boundingBox())!;
  expect(words.y).toBeGreaterThanOrEqual(heading.y + heading.height - 1);
  await phone.locator('.home-since-link').click();
  await expect.poll(() => triggers.first().getAttribute('aria-expanded')).toBe('true');
  await expect
    .poll(() => phone.evaluate(() => document.activeElement?.className ?? ''))
    .toContain('home-section-trigger');
  expect(await phone.evaluate(() => document.scrollingElement?.scrollTop)).toBe(0);
  // Every section open, it still fits and every control can still be hit.
  for (const trigger of (await triggers.all()).slice(1)) await trigger.click();
  await phone.locator('.home-stages').waitFor();
  expect(await sideways()).toEqual([true, true]);
  expect(await smallTargets(phone)).toEqual([]);
  await phone.close();
}, 45_000);

test('moves a waiting job to the top of Up next through Queue’s own order', async () => {
  const rail = page.getByRole('region', { name: 'Crew at work' });
  await rail.getByRole('button', { name: 'Order of Tidepool' }).click();
  await page.getByRole('menuitem', { name: 'Move to top' }).click();
  await expect
    .poll(() => railRows('.home-next .home-row-subject').allTextContents())
    .toEqual(['Tidepool', 'Northwind', 'Kestrel AI']);
  expect(decisions).toContain(
    `PUT /api/queue/${encodeURIComponent(`job:${fixture.cards.tidepool}`)}`,
  );
  const ready = (await snapshot()).queue!.queues.filter((queue) => queue.state === 'ready');
  expect(ready.map((queue) => queue.cardId)).toEqual([
    fixture.cards.tidepool,
    fixture.cards.northwind,
    fixture.cards.kestrel,
  ]);
  expect(await railRows('.home-next .home-row-says').first().textContent()).toContain(
    'Next in line',
  );
});

test('opens ?item= and reviews a proposal in place; declined elsewhere it leaves no record', async () => {
  const key = keys().proposal;
  await page.goto(`${host.daemon.url}/?item=${encodeURIComponent(key)}`);
  await expect.poll(focused).toBe(key);
  expect(await row(key).getAttribute('data-open')).toBe('');
  await expect.poll(() => page.url()).not.toContain('item=');
  await row(key).getByRole('button', { name: 'Review change', exact: true }).click();
  const card = row(key).locator('.needs-review .chat-proposal');
  await card.locator('[aria-label="Instruction changes"]').waitFor();
  // Flat inside the raised row: the row is the one raised surface.
  expect(
    await card.evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.paddingTop, style.boxShadow, style.backgroundImage];
    }),
  ).toEqual(['0px', 'none', 'none']);
  // Writer runs, so the daemon would refuse to apply its change now.
  expect(await card.getByRole('button', { name: 'Apply changes' }).isDisabled()).toBe(true);
  // Its verbs read as every open row's: Apply changes first, at the left, the note under them.
  const footer = card.locator('footer');
  expect(
    await footer.locator('button').evaluateAll((buttons) => buttons.map((b) => b.textContent)),
  ).toEqual(['Apply changes', 'Decline'].map((label) => expect.stringContaining(label)));
  const [applyChanges, decline, note] = await boxesIn(footer, [
    'button:has-text("Apply changes")',
    'button:has-text("Decline")',
    'p',
  ]);
  expect(applyChanges!.x + applyChanges!.width).toBeLessThanOrEqual(decline!.x);
  expect(note!.y).toBeGreaterThanOrEqual(applyChanges!.y + applyChanges!.height);
  expect(Math.abs(note!.x - applyChanges!.x)).toBeLessThan(2);
  await row(key).getByRole('button', { name: 'Hide change', exact: true }).waitFor();
  await host.request(`/proposals/${fixture.proposalId}/decide`, 'POST', { approved: false });
  await row(key).waitFor({ state: 'detached' });
  expect(await page.locator('.needs-row[data-record]').count()).toBe(0);
  await expectCount(5);
});

test('presses the open row’s verb with Control/Command+Enter from inside it only, after 800 ms, never on a submission', async () => {
  const lumen = askBrowser(fixture.runs.lumen, 'scout', fixture.cards.lumen, 'Read more');
  const key = `browser:${lumen.id}`;
  await row(key).waitFor();
  const sent = () => decisions.filter((entry) => entry.includes('/decide')).length;
  const before = sent();
  // The Initech submission row ignores it, even with focus inside after the arming wait.
  await openRow(keys().browser);
  await pastGuard();
  await row(keys().browser).getByRole('button', { name: 'Reject', exact: true }).focus();
  await page.keyboard.press(`${mod}+Enter`);
  // A field holds its own keys: the tracking review's Application select.
  await openRow(keys().tracking);
  await pastGuard();
  await row(keys().tracking).getByRole('combobox', { name: 'Application' }).focus();
  await page.keyboard.press(`${mod}+Enter`);
  // A closed row stays mounted once visited, and never fires.
  await trigger(key).click();
  await trigger(key).click();
  expect(await row(key).getAttribute('data-open')).toBeNull();
  await pastGuard();
  await trigger(key).focus();
  await page.keyboard.press(`${mod}+Enter`);
  await page.waitForTimeout(300);
  expect(sent()).toBe(before);
  expect(decisions.some((entry) => entry.includes('/tracking/'))).toBe(false);
  // Opened again, it waits 800 ms before the shortcut presses its verb. The gap is measured in the
  // page from before the click (so never shorter than the real one): only a press known to come
  // within 800 ms must be held, and a host slow enough to press later may see it go through.
  const opened = await page.evaluate(() => performance.now());
  await trigger(key).click();
  await page.keyboard.press(`${mod}+Enter`);
  const gap = (await page.evaluate(() => performance.now())) - opened;
  await page.waitForTimeout(300);
  if (gap < 800) expect(sent()).toBe(before);
  if (sent() === before) {
    await pastGuard();
    await page.keyboard.press(`${mod}+Enter`);
  }
  await record('Lumen Labs').waitFor();
  expect(sent()).toBe(before + 1);
  expect(await record('Lumen Labs').textContent()).toContain(
    'Approved: Click “Read more” on example.com. Scout carries it out.',
  );
  expect(
    host.daemon.service.board.get<ComputerApproval>('computer_approval', lumen.id).status,
  ).toBe('approved');
});

test('decides each seeded kind in place, leaving record lines and opening the next row', async () => {
  // Approve submission: saved, recorded where the row stood, the next row open and focused.
  await openRow(keys().browser);
  await pastGuard();
  await row(keys().browser)
    .getByRole('button', { name: 'Approve submission', exact: true })
    .click();
  await record('Initech').waitFor();
  expect(await record('Initech').textContent()).toContain(
    'Approved: Click “Submit application” on example.com. Submitter carries it out; you verify the outcome after.',
  );
  // One line on the rows' grid: the subject in its own column, left of the outcome, level with it.
  const line = await record('Initech').evaluate((element) => {
    const box = (selector: string) => element.querySelector(selector)!.getBoundingClientRect();
    const [subject, outcome] = [box('.needs-subject'), box('.needs-outcome')];
    return {
      apart: outcome.left - subject.right,
      level: Math.abs(outcome.top - subject.top),
      height: element.getBoundingClientRect().height,
    };
  });
  expect(line.apart).toBeGreaterThanOrEqual(0);
  expect(line.level).toBeLessThan(2);
  expect(line.height).toBeLessThan(80);
  expect(
    host.daemon.service.board.get<ComputerApproval>('computer_approval', fixture.approvalId).status,
  ).toBe('approved');
  await expectCount(4);
  await expect.poll(focused).toBe(keys().failure);
  expect(await row(keys().failure).getAttribute('data-open')).toBe('');
  // The failure is said once: its reason restates the headline, so whose work it was and when it
  // stopped stay.
  expect(await row(keys().failure).locator('.needs-headline').textContent()).toBe(
    'Scout’s fit evaluation stopped before finishing',
  );
  expect(await row(keys().failure).locator('.needs-who').textContent()).toMatch(
    /^Scout · .*\d:\d\d/,
  );
  expect(
    await page
      .locator('[data-slot="toast"]')
      .filter({ hasText: 'Browser action approved' })
      .count(),
  ).toBe(0);
  // Said once, by the desk's live region, with what opens next.
  expect(await page.locator('.needs > [aria-live="polite"]').textContent()).toBe(
    'Approved: Click “Submit application” on example.com. Submitter carries it out; you verify the outcome after. Next: Corvid, Failed request.',
  );
  // On a desk under 600px a record takes a closed row's shape: the outcome under the subject,
  // across the row, never a column beside it that narrows as the name grows.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      record('Initech').evaluate((element) => {
        const box = (selector: string) => element.querySelector(selector)!.getBoundingClientRect();
        const [subject, outcome] = [box('.needs-subject'), box('.needs-outcome')];
        return outcome.top >= subject.bottom - 1 && Math.abs(outcome.left - subject.left) < 1;
      }),
    )
    .toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('.home-strip').waitFor({ state: 'hidden' });
  await pastGuard();

  // A question never sends itself here: a suggestion, clicked or keyed, only selects; the detail
  // field keeps the choice; only Answer and continue posts.
  await openRow(keys().question);
  const umbra = row(keys().question);
  // It reads as every open row does: the question itself is the headline (the form's own title
  // gives way), its reason the evidence, then who asked and what waits, the suggestions, Answer
  // and continue first at the left, and the consequence under the verbs.
  expect(await umbra.locator('.needs-headline').textContent()).toBe(
    'Which project should lead the cover letter?',
  );
  expect(await umbra.locator('.user-question-title').isVisible()).toBe(false);
  const [headline, reason, who, waits, answer, cancel, gate] = await boxesIn(umbra, [
    '.needs-headline',
    '.needs-note',
    '.needs-who',
    '.needs-blocks',
    'button:text-is("Answer and continue")',
    'button:text-is("Cancel question")',
    '.needs-gate',
  ]);
  for (const [above, below] of [
    [headline, reason],
    [reason, who],
    [who, waits],
    [waits, answer],
  ])
    expect(above!.y + above!.height).toBeLessThanOrEqual(below!.y + 1);
  expect(answer!.x + answer!.width).toBeLessThanOrEqual(cancel!.x);
  expect(gate!.y).toBeGreaterThanOrEqual(answer!.y + answer!.height);
  expect(
    await umbra
      .locator('.user-question-actions button')
      .evaluateAll((buttons) => buttons.map((button) => button.textContent)),
  ).toEqual(['Answer and continue', 'Cancel question']);
  const option = (name: RegExp) => umbra.getByRole('button', { name });
  const pressed = (name: RegExp) => option(name).getAttribute('aria-pressed');
  const answers = () => decisions.filter((entry) => entry.includes('/user-input/')).length;
  // From the row's trigger, where focus lands after each decision, a digit does nothing at all.
  await trigger(keys().question).focus();
  await page.keyboard.press('2');
  await page.waitForTimeout(400);
  expect([answers(), await pressed(/Performance work/)]).toEqual([0, 'false']);
  await option(/Design systems/).click();
  await page.waitForTimeout(400);
  expect(answers()).toBe(0);
  // The field's label now asks for detail; no placeholder repeats it.
  expect(await umbra.getByLabel('Add detail (optional)').getAttribute('placeholder')).toBeNull();
  expect([await pressed(/Design systems/), await pressed(/Performance work/)]).toEqual([
    'true',
    'false',
  ]);
  // Inside the form a digit picks another suggestion, and still sends nothing.
  await page.keyboard.press('2');
  await page.waitForTimeout(400);
  expect(answers()).toBe(0);
  expect([await pressed(/Design systems/), await pressed(/Performance work/)]).toEqual([
    'false',
    'true',
  ]);
  await umbra.getByLabel('Add detail (optional)').fill('Lead with the latency budget.');
  expect(await pressed(/Performance work/)).toBe('true');
  expect(answers()).toBe(0);
  const answered = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().includes('/user-input/'),
  );
  await umbra.getByRole('button', { name: 'Answer and continue', exact: true }).click();
  expect((await answered).postDataJSON()).toEqual({
    selected: ['performance'],
    text: 'Lead with the latency budget.',
  });
  await record('Umbra Health').waitFor();
  expect(await record('Umbra Health').textContent()).toContain('Answered “Performance work”');
  expect(answers()).toBe(1);
  await pastGuard();

  // The failed request, retried: it rejoins the end of the waiting line, behind three more fits,
  // and stays drawn in Up next although the rows before it fold away.
  queueMoreFits(host.daemon.service, ['Ostrava Labs', 'Pelican Works', 'Quarry AI']);
  await expect.poll(() => railRows('.home-rest-trigger').count()).toBe(1);
  await openRow(keys().failure);
  await row(keys().failure).getByRole('button', { name: 'Retry', exact: true }).click();
  await record('Corvid').waitFor();
  const ready = (await snapshot()).queue!.queues.filter((queue) => queue.state === 'ready');
  expect(ready.at(-1)?.id).toBe(fixture.failedQueueId);
  const place = `${ordinal(ready.length)} in line`;
  expect(await record('Corvid').textContent()).toContain(`Retry queued · ${place}`);
  const corvid = railRows('.home-next').filter({ hasText: 'Corvid' });
  await corvid.waitFor();
  expect(await corvid.locator('.home-row-says').textContent()).toContain(
    `${place.charAt(0).toUpperCase()}${place.slice(1)}`,
  );
  expect(await railRows('.home-rest-trigger').textContent()).toMatch(/^\d+ more waiting/);
  await pastGuard();

  // The brief opens job details at Application; confirming it there leaves no record, and focus
  // comes back to the next row's trigger once the sheet closes, never to a sidebar link.
  await openRow(keys().brief);
  await row(keys().brief).getByRole('button', { name: 'Review and confirm', exact: true }).click();
  const sheet = page.locator('.card-details-panel');
  await sheet.waitFor();
  await sheet.getByRole('tab', { name: 'Application', selected: true }).waitFor();
  await confirmFixtureApplication(host.request, fixture.cards.quill);
  await row(keys().brief).waitFor({ state: 'detached' });
  expect(await record('Quill Studio').count()).toBe(0);
  await page.keyboard.press('Escape');
  await sheet.waitFor({ state: 'detached' });
  await expect.poll(focused).toBe(keys().tracking);

  // The tracking review shows its evidence before who matched it and Apply update, with what
  // approving does under the verbs, then records the outcome.
  await row(keys().tracking)
    .getByText('We would like to schedule a screening call.', { exact: true })
    .waitFor();
  const [quote, matched, apply, approval] = await boxesIn(row(keys().tracking), [
    'text="We would like to schedule a screening call."',
    '.needs-who',
    'button:has-text("Apply update")',
    'text=/^Approval links this email thread/',
  ]);
  expect(quote!.y + quote!.height).toBeLessThanOrEqual(matched!.y + 1);
  expect(matched!.y + matched!.height).toBeLessThanOrEqual(apply!.y + 1);
  expect(approval!.y).toBeGreaterThanOrEqual(apply!.y + apply!.height);
  await pastGuard();
  await row(keys().tracking)
    .getByRole('button', { name: /^Apply update/ })
    .click();
  await record('Bluefin').waitFor();
  expect(await record('Bluefin').textContent()).toContain('Recorded Screening');
  expect(await record('Bluefin').locator('.clay-bead').getAttribute('data-tone')).toBe('moss');
  await page.getByText('Nothing else needs you. The crew carries on.').waitFor();
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.hasAttribute('data-needs-end')))
    .toBe(true);
  // The finished morning reads as one list: the decided tiers share one "Decided" caption, and
  // screen readers hear one group holding every record line.
  expect(await page.locator('.needs-tier-caption').allTextContents()).toEqual(['Decided']);
  const decided = page.locator('.needs-tray').getByRole('group', { name: 'Decided', exact: true });
  const lines = await page.locator('.needs-row[data-record]').count();
  expect(lines).toBeGreaterThanOrEqual(4);
  expect(await decided.locator('.needs-row[data-record]').count()).toBe(lines);
}, 60000);

/**
 * Clicks a row's Approve button at the given point, as a slow double-click's second press would
 * land on it: a click event with that point and a click count, dispatched on the button itself so
 * the rows' layout cannot decide what it hits. It waits up to 10 s for the row to open, then clicks
 * within a frame of it, and resolves false when the row never opened.
 */
const pressApprove = (key: string, at: { x: number; y: number }) =>
  page.evaluate(
    ({ key, x, y }) =>
      new Promise<boolean>((resolve) => {
        const started = performance.now();
        const look = () => {
          const button = [
            ...document.querySelectorAll<HTMLButtonElement>(
              `[data-needs-key="${key}"][data-open] .needs-open-body button`,
            ),
          ].find(
            (candidate) => candidate.textContent?.startsWith('Approve') && !candidate.disabled,
          );
          if (!button) {
            if (performance.now() - started > 10_000) resolve(false);
            else requestAnimationFrame(look);
            return;
          }
          button.dispatchEvent(
            new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              clientX: x,
              clientY: y,
              detail: 1,
            }),
          );
          resolve(true);
        };
        look();
      }),
    { key, ...at },
  );

test('drops a click on the deciding spot in the next row for 800 ms, then takes clicks again', async () => {
  const halcyon = askBrowser(fixture.runs.halcyon, 'reviewer', fixture.cards.halcyon, 'Notes');
  const acme = askBrowser(fixture.runs.acme, 'writer', fixture.cards.acme, 'Read more');
  const next = `browser:${acme.id}`;
  await row(next).waitFor();
  await openRow(`browser:${halcyon.id}`);
  await pastGuard();
  const approve = row(`browser:${halcyon.id}`).getByRole('button', { name: 'Approve click' });
  const box = (await approve.boundingBox())!;
  const spot = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const sent = () => decisions.filter((entry) => entry.endsWith(`/${acme.id}/decide`)).length;
  // Waiting for Acme's row to open next, the second press lands on its Approve at the spot of the
  // deciding click, within a frame of the row opening: the guard drops it.
  const second = pressApprove(next, spot);
  await page.mouse.click(spot.x, spot.y);
  expect(await second).toBe(true);
  await record('Halcyon').waitFor();
  await page.waitForTimeout(300);
  expect(sent()).toBe(0);
  expect(await row(next).getAttribute('data-open')).toBe('');
  // The same press past the guard goes through, so the guard, not the layout, dropped the first.
  await pastGuard();
  expect(await pressApprove(next, spot)).toBe(true);
  await record('Acme Robotics').waitFor();
  expect(sent()).toBe(1);
  expect(await record('Acme Robotics').textContent()).toContain(
    'Approved: Click “Read more” on example.com. Writer carries it out.',
  );
});

test('holds clicks in the row that opens when the open row is resolved elsewhere', async () => {
  const first = askBrowser(fixture.runs.lumen, 'scout', fixture.cards.lumen, 'Benefits');
  const then = askBrowser(fixture.runs.globex, 'writer', fixture.cards.globex, 'Team');
  const next = `browser:${then.id}`;
  await row(next).waitFor();
  await openRow(`browser:${first.id}`);
  await pastGuard();
  const sent = () => decisions.filter((entry) => entry.endsWith(`/${then.id}/decide`)).length;
  const records = await page.locator('.needs-row[data-record]').count();
  // Decided elsewhere, Lumen's row leaves and Globex's opens in its place, where a click aimed at
  // Lumen's Approve would land: for 800 ms its body takes none, wherever the click falls.
  const aimed = pressApprove(next, { x: 10, y: 10 });
  await host.request(`/computer-approvals/${first.id}/decide`, 'POST', { approved: false });
  expect(await aimed).toBe(true);
  await page.waitForTimeout(300);
  expect(sent()).toBe(0);
  expect(await page.locator('.needs-row[data-record]').count()).toBe(records);
  await pastGuard();
  expect(await pressApprove(next, { x: 10, y: 10 })).toBe(true);
  await record('Globex').waitFor();
  expect(sent()).toBe(1);
});

test('records only what a Skip completed, and offers a queue left paused its own Resume', async () => {
  const ferro = failFit(host.daemon.service, 'Ferro Labs');
  const key = `failure:${ferro.queueId}`;
  const lane = `/api/queue/${encodeURIComponent(ferro.queueId)}`;
  const resumes = () => decisions.filter((entry) => entry === `PUT ${lane}`).length;
  const refuse = (message: string) => (route: Route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: `{"error":"${message}"}` });
  const toast = (text: string) => page.locator('[data-slot="toast"]').filter({ hasText: text });
  const skip = () => row(key).getByRole('button', { name: 'Skip and continue', exact: true });
  await row(key).waitFor();
  await openRow(key);
  await pastGuard();
  // The removal refused: no record, no resume sent, and the row still offers Retry and Skip.
  const removal = (url: URL) => url.pathname === `/api/chat-requests/${ferro.requestId}`;
  await page.route(removal, refuse('Remove refused (fixture).'));
  await skip().click();
  await toast('Remove refused (fixture).').waitFor();
  expect(await record('Ferro Labs').count()).toBe(0);
  expect(resumes()).toBe(0);
  await row(key).getByRole('button', { name: 'Retry', exact: true }).waitFor();
  await page.unroute(removal);
  // The removal saved but the queue's resume refused: the record says only what completed.
  const resume = (url: URL) => url.pathname === lane;
  await page.route(resume, refuse('Resume refused (fixture).'));
  await skip().click();
  await toast('Resume refused (fixture).').waitFor();
  await expect
    .poll(() => record('Ferro Labs').textContent())
    .toContain('Skipped the fit evaluation · the job’s queue is still paused');
  expect(host.daemon.service.board.get<WorkQueue>('work_queue', ferro.queueId)).toMatchObject({
    paused: true,
    pauseKind: 'failed',
  });
  await page.unroute(resume);
  // Work queued for the job later finds its queue still paused, with nothing to retry: the row
  // offers the queue's own Resume instead of a dead end.
  host.daemon.service.queueBoardAction({ cardId: ferro.cardId, action: 'fit' });
  await row(key).waitFor();
  await openRow(key);
  expect(await row(key).locator('.needs-headline').textContent()).toBe(
    'Paused until you resume the queue',
  );
  // What paused it reads as history, without the retry it once advised, and the note opens with
  // what changed since.
  expect(await row(key).locator('.needs-who').textContent()).toBe(
    'Paused when: Scout’s fit evaluation stopped before finishing.',
  );
  expect(await row(key).locator('.needs-note').textContent()).toBe(
    'The stopped work is gone. Resume the queue to start what waits in it.',
  );
  const resumeQueue = row(key).getByRole('button', { name: 'Resume queue', exact: true });
  expect([await skip().count(), await resumeQueue.count()]).toEqual([0, 1]);
  await pastGuard();
  await resumeQueue.click();
  await expect
    .poll(() => record('Ferro Labs').textContent())
    .toMatch(/Resumed the job’s queue · (next|\d+\w\w) in line$/);
  expect(resumes()).toBe(2);
  expect(host.daemon.service.board.get<WorkQueue>('work_queue', ferro.queueId).paused).toBe(false);
}, 30_000);

test('logs no page errors and no Base UI warnings', () => {
  expect(problems).toEqual([]);
});
