import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { adapters } from '../../adapters/src/index.ts';
import type { Card, RunContext, Run, UserInputRequest } from '@pitchcrew/core';
import { cleanup, confirmFixtureApplication, finish, setup } from './helpers/daemon.ts';
let host: Awaited<ReturnType<typeof setup>>;
let browser: Browser;
let page: Page;
let card: Card;
const errors: string[] = [];
beforeAll(async () => {
  host = await setup();
  await host.daemon.service.saveProfile(
    'experience.md',
    '# Experience\n\n- Built fictional React interfaces.',
  );
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.message));
}, 60000);
beforeEach(async () => {
  card = host.daemon.service.createCard({
    company: 'Fictional Studio',
    title: 'Design Engineer',
    description: 'Build accessible interfaces and reusable components.',
    location: 'Berlin · Hybrid',
    salary: '€80k–€100k',
    url: 'https://example.com/fictional-job',
  });
  host.daemon.service.moveCard(card.id, 'shortlisted');
  await confirmFixtureApplication(host.request, card.id);
  await page.goto(host.daemon.url);
  await page.locator(`#board-job-${card.id} .clay-job-card`).waitFor({ timeout: 30000 });
  const later = page.getByRole('button', { name: 'Set up later', exact: true });
  if (await later.isVisible()) await later.click();
  await page.locator(`#board-job-${card.id} .clay-job-card`).click();
  await page.getByRole('tab', { name: 'Job', exact: true }).waitFor();
}, 30000);
afterAll(async () => {
  await browser?.close();
  await cleanup();
});
test('puts the role first, defers reviews and preserves the compact layout on mobile', async () => {
  const sheet = page.getByRole('dialog', { name: 'Job details', exact: true });
  expect(await sheet.getByRole('tab').allTextContents()).toEqual([
    'Job',
    'Application',
    'Activity',
  ]);
  expect(await sheet.getByRole('heading', { name: 'About the role' }).isVisible()).toBe(true);
  const sheetBounds = (await sheet.boundingBox())!;
  const appBarBounds = (await page.locator('.desktop-titlebar').boundingBox())!;
  expect(sheetBounds.y).toBe(appBarBounds.y + appBarBounds.height);
  const description = await sheet.getByRole('heading', { name: 'About the role' }).boundingBox();
  // Keep the same compact content budget below the app bar, where the sheet now begins.
  expect(description!.y - sheetBounds.y).toBeLessThan(300);
  expect(await sheet.getByRole('button', { name: 'Draft application', exact: true }).count()).toBe(
    1,
  );
  expect(await sheet.getByRole('textbox', { name: 'New lesson' }).count()).toBe(0);
  await sheet.getByRole('tab', { name: 'Application', exact: true }).click();
  expect(await sheet.getByRole('button', { name: 'Draft application', exact: true }).count()).toBe(
    1,
  );
  expect(
    await sheet.getByRole('heading', { name: 'Deep resume reviews', exact: true }).count(),
  ).toBe(0);
  await sheet.getByRole('button', { name: 'Brief and requirements Confirmed' }).click();
  expect(await sheet.getByRole('button', { name: 'Edit brief', exact: true }).isVisible()).toBe(
    true,
  );
  // Compare with posting puts the saved posting beside the brief and widens the sheet.
  const narrow = (await sheet.boundingBox())!.width;
  await sheet.getByRole('button', { name: 'Compare with posting', exact: true }).click();
  const posting = sheet.getByRole('region', { name: 'Original posting', exact: true });
  await posting
    .getByText('Build accessible interfaces and reusable components.', { exact: true })
    .waitFor();
  await expect.poll(async () => (await sheet.boundingBox())!.width).toBeGreaterThan(narrow + 200);
  await sheet.getByRole('button', { name: 'Hide posting', exact: true }).click();
  await expect.poll(() => posting.count()).toBe(0);
  await expect.poll(async () => (await sheet.boundingBox())!.width).toBe(narrow);
  await page.setViewportSize({ width: 390, height: 844 });
  await sheet.getByRole('tab', { name: 'Job', exact: true }).click();
  // Phones fold the progress row away once the reading column scrolls, and bring it back at the top.
  const panel = page.locator('.card-details-panel');
  const content = sheet.getByRole('tabpanel', { name: 'Job', exact: true });
  await content.evaluate((node) => {
    const spacer = document.createElement('div');
    spacer.className = 'test-spacer';
    spacer.style.height = '1600px';
    node.append(spacer);
    node.scrollTop = 400;
  });
  await expect.poll(() => panel.getAttribute('data-condensed')).toBe('');
  // Visibility flips once the fold transition ends, so the row is never hidden mid-animation.
  await expect.poll(() => sheet.locator('.detail-progress').isVisible()).toBe(false);
  await content.evaluate((node) => {
    node.scrollTop = 0;
  });
  await expect.poll(() => panel.getAttribute('data-condensed')).toBeNull();
  await content.evaluate((node) => node.querySelector('.test-spacer')?.remove());
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const footer = await sheet
    .getByRole('button', { name: 'Draft application', exact: true })
    .boundingBox();
  expect(footer!.y + footer!.height).toBeLessThanOrEqual(844);
  await page.setViewportSize({ width: 1280, height: 800 });
  expect(errors).toEqual([]);
});
test('retains lesson and identifier drafts across sections and protects closing until saved', async () => {
  await page.getByRole('tab', { name: 'Activity', exact: true }).click();
  await page.getByRole('button', { name: 'What you learned', exact: true }).click();
  const lesson = page.getByRole('textbox', { name: 'New lesson', exact: true });
  await lesson.fill('Keep this draft across tabs.');
  await page.getByRole('tab', { name: 'Job', exact: true }).click();
  await page.getByRole('tab', { name: 'Application', exact: true }).click();
  await page.getByRole('tab', { name: 'Activity', exact: true }).click();
  expect(await lesson.inputValue()).toBe('Keep this draft across tabs.');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  expect(await lesson.inputValue()).toBe('Keep this draft across tabs.');
  await page.getByRole('button', { name: 'Add lesson', exact: true }).click();
  await expect.poll(() => lesson.inputValue()).toBe('');
  await page.getByRole('button', { name: 'Tracking evidence', exact: true }).click();
  const identifier = page.getByRole('textbox', { name: 'Job identifier', exact: true });
  await identifier.fill('REQ-2048');
  await page.getByRole('tab', { name: 'Job', exact: true }).click();
  await page.getByRole('tab', { name: 'Activity', exact: true }).click();
  expect(await identifier.inputValue()).toBe('REQ-2048');
  await page.getByRole('button', { name: 'Save identifier', exact: true }).click();
  await expect
    .poll(() => host.daemon.service.board.get<Card>('card', card.id).tracking?.jobIdentifier)
    .toBe('REQ-2048');
  await page.getByText('Job identifier saved', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect
    .poll(() => page.getByRole('dialog', { name: 'Job details', exact: true }).count())
    .toBe(0);
  expect(errors).toEqual([]);
});
test('previews the live workflow turn and opens that exact job chat without cancelling it', async ({
  onTestFinished,
}) => {
  let context: RunContext | undefined;
  let release!: () => void;
  const original = adapters.demo.run;
  const spy = vi.spyOn(adapters.demo, 'run').mockImplementation(async (turn) => {
    context = turn;
    turn.onActivity?.({
      id: 'note',
      kind: 'commentary',
      label: 'Progress',
      text: 'Checking the confirmed brief.',
      status: 'completed',
    });
    turn.onActivity?.({
      id: 'tool',
      kind: 'tool',
      label: 'Reading profile',
      text: 'PRIVATE TOOL PAYLOAD',
      status: 'running',
    });
    await new Promise<void>((resolve) => {
      release = resolve;
      turn.signal.addEventListener('abort', () => resolve(), { once: true });
    });
    return original(turn);
  });
  onTestFinished(() => {
    release?.();
    spy.mockRestore();
  });
  await page.getByRole('button', { name: 'Draft application', exact: true }).click();
  await expect.poll(() => Boolean(context)).toBe(true);
  const avatar = page.getByRole('link', { name: 'Writer: Running. Open job chat', exact: true });
  await avatar.waitFor();
  await avatar.hover();
  await page
    .locator('[data-slot=tooltip-content]')
    .getByText('Checking the confirmed brief.', { exact: true })
    .waitFor();
  expect(await page.locator('[data-slot=tooltip-content]').innerText()).toContain(
    'Reading profile',
  );
  expect(await page.locator('[data-slot=tooltip-content]').innerText()).not.toContain('PRIVATE');
  const run = host.daemon.service.board
    .list<Run>('run')
    .find((run) => run.cardId === card.id && run.status === 'running')!;
  await avatar.click();
  await page.waitForURL(`**/chat/${run.threadId}?run=${run.id}`);
  await page.locator(`#run-${run.id}`).waitFor();
  expect(host.daemon.service.board.get<Run>('run', run.id).status).toBe('running');
  await expect
    .poll(() => page.getByRole('dialog', { name: 'Job details', exact: true }).count())
    .toBe(0);
  context!.onActivity!({
    id: 'note-2',
    kind: 'commentary',
    label: 'Progress',
    text: 'Matching the draft to the role.',
    status: 'completed',
  });
  await page.getByText('Matching the draft to the role.', { exact: true }).waitFor();
  release();
  await finish(host.request, run.id);
  await page.reload();
  const savedTurn = page.locator(`#run-${run.id}`);
  await savedTurn.waitFor({ timeout: 30000 });
  const activity = savedTurn.locator('.chat-turn-disclosure');
  expect(await activity.getAttribute('aria-expanded')).toBe('false');
  await activity.click();
  await savedTurn.getByText('Matching the draft to the role.', { exact: true }).waitFor();
  expect(errors).toEqual([]);
}, 30000);

test('shows a waiting review once across sheet entry points and keeps independent turns navigable', async () => {
  const service = host.daemon.service;
  const thread = service.createConversation({
    title: 'Resume review',
    participants: ['reviewer'],
    cardId: card.id,
  });
  const otherThread = service.createConversation({
    title: 'Packet questions',
    participants: ['reviewer'],
    cardId: card.id,
  });
  const parent: Run = {
    id: `review-parent-${card.id}`,
    cardId: card.id,
    roleId: 'reviewer',
    runtime: 'demo',
    mode: 'workflow',
    purpose: 'deep-review',
    deepReviewId: `report-${card.id}`,
    rootRunId: 'earlier-request',
    threadId: thread.id,
    status: 'waiting',
    message: 'Waiting for your answer',
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  const worker: Run = {
    ...parent,
    id: `review-question-${card.id}`,
    purpose: 'application-review',
    reviewStage: 'review',
    activity: [
      {
        id: 'public',
        kind: 'commentary',
        label: 'Update',
        text: 'Checking the evidence for this review.',
        status: 'completed',
        startedAt: parent.startedAt,
        finishedAt: parent.startedAt,
      },
    ],
  };
  const saveRun = (run: Run) => service.board.record('run', run, run.roleId, run.message);
  saveRun(parent);
  saveRun(worker);
  service.board.record(
    'user_input',
    {
      id: `question-${card.id}`,
      runId: worker.id,
      roleId: worker.roleId,
      cardId: card.id,
      threadId: thread.id,
      sourceThreadId: thread.id,
      messageId: `question-message-${card.id}`,
      question: 'Which evidence should I use?',
      continuationNotes: 'Continue the review.',
      options: [],
      multiSelect: false,
      reason: '',
      status: 'pending',
      createdAt: parent.startedAt,
    } satisfies UserInputRequest,
    'reviewer',
    'Asked a review question',
  );
  const openBoardJob = async () => {
    await page.goto(host.daemon.url);
    await page.locator(`#board-job-${card.id} .clay-job-card`).click();
    await page.getByRole('tab', { name: 'Job', exact: true }).waitFor();
  };
  await openBoardJob();
  const chips = page.locator('.detail-agent');
  await expect.poll(() => chips.count()).toBe(1);
  expect(await chips.innerText()).toContain('Reviewer');
  expect(await chips.innerText()).toContain('Waiting for you');
  expect(await chips.getAttribute('href')).toBe(`/chat/${thread.id}?run=${worker.id}`);
  // The dock quotes the question and answers it in place with the chat's own form.
  const dock = page.locator('.detail-footer');
  await dock.getByText('Reviewer asks: “Which evidence should I use?”', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Answer here', exact: true }).click();
  await dock.getByRole('button', { name: 'Answer and continue', exact: true }).waitFor();
  // While answering, the form carries the question and Hide only folds it away.
  expect(await dock.getByRole('button', { name: 'Answer in job chat', exact: true }).count()).toBe(
    0,
  );
  expect(
    await dock.getByText('Reviewer continues after you answer.', { exact: true }).count(),
  ).toBe(1);
  await dock.getByRole('button', { name: 'Hide answer', exact: true }).click();
  await expect
    .poll(() => dock.getByRole('button', { name: 'Answer and continue' }).count())
    .toBe(0);
  await chips.hover();
  await page
    .locator('[data-slot=tooltip-content]')
    .getByText('Waiting for you', { exact: true })
    .waitFor();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.locator(`#board-job-${card.id} .clay-job-card`).click();
  await expect.poll(() => chips.count()).toBe(1);
  await chips.click();
  await page.waitForURL(`**/chat/${thread.id}?run=${worker.id}`);
  await page.locator(`#run-${worker.id}`).waitFor();
  await page.getByRole('button', { name: 'Job', exact: true }).click();
  await expect.poll(() => chips.count()).toBe(1);

  const independent: Run = {
    ...worker,
    id: `independent-${card.id}`,
    threadId: otherThread.id,
    deepReviewId: 'another-report',
    status: 'running',
    message: 'Checking packet files',
    activity: [{ ...worker.activity![0], text: 'Inspecting the separate packet.' }],
  };
  saveRun(independent);
  await openBoardJob();
  await expect.poll(() => chips.count()).toBe(2);
  const review = chips.filter({ hasText: 'Resume review' });
  const packet = chips.filter({ hasText: 'Packet questions' });
  expect(await review.innerText()).toContain('Waiting for you');
  expect(await packet.innerText()).toContain('Running');
  await page.keyboard.press('Tab');
  await packet.focus();
  await page
    .locator('[data-slot=tooltip-content]')
    .getByText('Inspecting the separate packet.', { exact: true })
    .waitFor();
  await packet.click();
  await page.waitForURL(`**/chat/${otherThread.id}?run=${independent.id}`);
  await page.locator(`#run-${independent.id}`).waitFor();
  expect(service.board.get<Run>('run', independent.id).status).toBe('running');
  expect(service.board.get<Run>('run', worker.id).status).toBe('waiting');
  saveRun({ ...independent, status: 'completed' });
  saveRun({ ...worker, status: 'cancelled' });
  saveRun({ ...parent, status: 'cancelled' });
  expect(errors).toEqual([]);
}, 30000);

test('opens Writing settings from the redesigned application documents and closes the job sheet', async () => {
  await page.getByRole('tab', { name: 'Application', exact: true }).click();
  // Application opens on the current step, here Documents; open it only if it is closed.
  const documents = page.getByRole('button', { name: /^Documents/ });
  if ((await documents.getAttribute('aria-expanded')) !== 'true') await documents.click();
  await page.getByRole('button', { name: 'Writing guide', exact: true }).click();
  await page.getByRole('heading', { name: /^Writing guide/ }).waitFor();
  expect(new URL(page.url()).searchParams.get('section')).toBe('writing');
  await expect
    .poll(() => page.getByRole('dialog', { name: 'Job details', exact: true }).count())
    .toBe(0);
  expect(errors).toEqual([]);
});

test('shows the job identity and a loading skeleton while its source is opening', async ({
  onTestFinished,
}) => {
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const sourceUrl = `${host.daemon.url}/api/cards/${card.id}`;
  await page.route(sourceUrl, async (route) => {
    await gate;
    await route.continue();
  });
  onTestFinished(async () => {
    release();
    await page.unroute(sourceUrl);
  });
  await page.locator(`#board-job-${card.id} .clay-job-card`).click();
  const sheet = page.getByRole('dialog', { name: 'Job details', exact: true });
  await sheet.getByText('Loading job details…', { exact: true }).waitFor();
  expect(await sheet.getByRole('heading', { name: card.title, exact: true }).isVisible()).toBe(
    true,
  );
  expect(await sheet.locator('[aria-busy=true] [data-slot=skeleton]').count()).toBeGreaterThan(0);
  release();
  await sheet.getByRole('tab', { name: 'Job', exact: true }).waitFor();
});

test('acknowledges agent startup before the request completes, shares it with the board and recovers on failure', async ({
  onTestFinished,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const launchUrl = `${host.daemon.url}/api/queue/actions`;
  await page.route(launchUrl, async (route) => {
    await gate;
    await route.fulfill({ status: 409, json: { error: 'Fictional startup failed' } });
  });
  onTestFinished(async () => {
    release();
    await page.unroute(launchUrl);
  });
  const sheet = page.getByRole('dialog', { name: 'Job details', exact: true });
  await sheet.getByRole('button', { name: 'Draft application', exact: true }).click();
  const starting = sheet.getByRole('button', { name: 'Starting agent…', exact: true });
  await starting.waitFor();
  expect(await starting.isDisabled()).toBe(true);
  expect(await sheet.getByRole('button', { name: 'Edit job', exact: true }).isDisabled()).toBe(
    true,
  );
  expect(await starting.locator('svg').count()).toBe(1);
  await sheet.getByRole('button', { name: 'Close dialog', exact: true }).click();
  const job = page.locator(`#board-job-${card.id}`);
  await job.getByRole('status').getByText('Starting agent…', { exact: true }).waitFor();
  release();
  await page.getByText('Fictional startup failed', { exact: true }).waitFor();
  await expect.poll(() => job.getByRole('status').count()).toBe(0);
  await job.locator('.clay-job-card').click();
  await page.getByRole('button', { name: 'Draft application', exact: true }).waitFor();
  await expect
    .poll(() => page.getByRole('button', { name: 'Edit job', exact: true }).isDisabled())
    .toBe(false);
  expect(errors).toEqual([]);
});

test('shows immediate feedback on a stage button and in the sheet header until the move finishes', async ({
  onTestFinished,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const moveUrl = `${host.daemon.url}/api/cards/${card.id}/move`;
  await page.route(moveUrl, async (route) => {
    await gate;
    await route.continue();
  });
  onTestFinished(async () => {
    release();
    await page.unroute(moveUrl);
  });
  const sheet = page.getByRole('dialog', { name: 'Job details', exact: true });
  await sheet.getByRole('tab', { name: 'Activity', exact: true }).click();
  // A manual status change is one quiet menu beside the job's status.
  await sheet.getByRole('button', { name: 'Change…', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Mark withdrawn', exact: true }).click();
  const moving = sheet.getByRole('button', { name: 'Moving…', exact: true });
  await moving.waitFor();
  expect(await moving.isDisabled()).toBe(true);
  expect(await sheet.getByRole('button', { name: 'Edit job', exact: true }).isDisabled()).toBe(
    true,
  );
  expect(await moving.locator('svg.spin').count()).toBe(1);
  await sheet.getByRole('status').getByText('Moving to Withdrawn…', { exact: true }).waitFor();
  expect(host.daemon.service.board.get<Card>('card', card.id).state).toBe('shortlisted');
  release();
  await sheet.locator('.clay-job-progress .detail-closed[data-state="withdrawn"]').waitFor();
  expect(host.daemon.service.board.get<Card>('card', card.id).state).toBe('withdrawn');
});

test('reevaluates a submitted job with the whole packet and shows a separate packet rating', async () => {
  const { packet } = await import('../../board/test/fixtures/packet.ts');
  const board = host.daemon.service.board;
  const current = board.get<Card>('card', card.id);
  board.record(
    'card',
    { ...current, state: 'submitted', packet },
    'user',
    'Fictional submitted packet',
  );
  const evaluate = vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    expect(context.purpose).toBe('packet-evaluation');
    expect(context.card.packet).toEqual(packet);
    return {
      role: 'scout',
      fit: 89,
      reasons: ['Strong Profile evidence.'],
      packetFit: {
        score: 78,
        reasons: ['The cover letter needs a clearer link to accessible interfaces.'],
      },
    };
  });
  await page.reload();
  await page.locator(`#board-job-${card.id} .clay-job-card`).waitFor({ timeout: 30000 });
  await page.locator(`#board-job-${card.id} .clay-job-card`).click();
  const sheet = page.getByRole('dialog', { name: 'Job details', exact: true });
  // Packet match rates the packet, so it lives with the application rather than the posting.
  await sheet.getByRole('tab', { name: 'Application', exact: true }).click();
  const region = sheet.getByRole('region', { name: 'Packet match to job', exact: true });
  await region.getByRole('button', { name: 'Reevaluate with packet', exact: true }).click();
  await expect.poll(() => board.get<Card>('card', card.id).packetFit?.score).toBe(78);
  await region.getByRole('heading', { name: /^Packet match 78/ }).waitFor();
  const ratings = sheet.locator('.detail-state');
  expect(await ratings.getByText('Fit 89', { exact: true }).isVisible()).toBe(true);
  expect(await ratings.getByText('Packet match 78', { exact: true }).isVisible()).toBe(true);
  expect(await region.innerText()).toContain(
    'The cover letter needs a clearer link to accessible interfaces.',
  );
  expect(board.get<Card>('card', card.id).state).toBe('submitted');
  expect(evaluate).toHaveBeenCalledOnce();
  evaluate.mockRestore();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 800 });
});
