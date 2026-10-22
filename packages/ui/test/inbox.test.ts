import { randomUUID } from 'node:crypto';
import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type {
  Approval,
  Card,
  Run,
  ChatRequest,
  ComputerApproval,
  SubmissionAttempt,
} from '@pitchcrew/core';
import { setup, cleanup, confirmFixtureApplication, finish } from './helpers/daemon.ts';
let host: Awaited<ReturnType<typeof setup>>;
let browser: Browser;
let page: Page;
let approval: Approval;
let card: Card;
const errors: string[] = [];
beforeAll(async () => {
  host = await setup(14679);
  await host.request('/profile', 'PUT', {
    name: 'profile.md',
    content: '# Example Candidate\n\n- Built React interfaces.\n',
  });
  ({ result: card } = await host.request<Card>('/cards', 'POST', {
    company: 'Juniper Fixture',
    title: 'React Engineer',
    description: 'Build React interfaces.',
    url: 'https://example.com/fictional-application',
  }));
  await confirmFixtureApplication(host.request, card.id);
  await host.request(`/cards/${card.id}/move`, 'POST', { state: 'shortlisted' });
  for (const roleId of ['writer', 'reviewer']) {
    const { result: run } = await host.request<Run>(`/cards/${card.id}/run`, 'POST', { roleId });
    await finish(host.request, run.id);
  }
  ({ result: approval } = await host.request<Approval>(`/cards/${card.id}/approval`, 'POST', {
    formats: ['pdf', 'docx'],
  }));
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(15000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${host.daemon.url}/inbox`);
  await page.getByRole('button', { name: 'Set up later', exact: true }).click();
  await page
    .getByRole('button', { name: /Pitchcrew Your application packet/ })
    .waitFor({ timeout: 30000 });
}, 90000);
afterAll(async () => {
  await browser?.close();
  await cleanup();
});
test('uses email rows and searches filenames before opening an exact reading view', async () => {
  await page.getByRole('textbox', { name: 'Search inbox' }).fill('resume.pdf');
  expect(await page.locator('.mail-row').count()).toBe(1);
  await page.getByRole('button', { name: /Pitchcrew Your application packet/ }).click();
  expect(await page.locator('.mailbox').count()).toBe(0);
  expect(await page.getByRole('button', { name: /^resume.pdf PDF/ }).count()).toBe(1);
  expect(await page.getByRole('button', { name: /^resume.md Markdown/ }).count()).toBe(1);
  await page.getByRole('button', { name: 'Back to inbox' }).click();
  expect(await page.locator('.mail-row').getAttribute('data-unread')).toBe('false');
  await page.getByRole('button', { name: 'Unread', exact: true }).click();
  expect(await page.locator('.mail-row').count()).toBe(0);
  await page.getByRole('button', { name: 'Unread', exact: true }).click();
  await page.getByRole('button', { name: /Pitchcrew Your application packet/ }).click();
});
test('searches actual PDF text, zooms sharply and keeps approval out of attachment dialogs', async () => {
  await page.getByRole('button', { name: /^resume.pdf PDF/ }).click();
  const dialog = page.getByRole('dialog', { name: 'resume.pdf', exact: true });
  await dialog
    .locator('.textLayer')
    .getByText('Built React interfaces.', { exact: false })
    .waitFor();
  expect(await dialog.getByRole('button', { name: /Approve/ }).count()).toBe(0);
  expect(
    await dialog.getByRole('button', { name: 'Download resume.pdf', exact: true }).isDisabled(),
  ).toBe(true);
  await dialog.getByRole('button', { name: 'Find', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Find in document' }).fill('React');
  await expect.poll(() => dialog.locator('.file-findbar output').textContent()).toBe('1 of 2');
  expect(await page.evaluate(() => CSS.highlights.get('file-matches')?.size)).toBe(2);
  const before = await dialog
    .locator('.file-pdf-page canvas')
    .evaluate((node) => (node as HTMLCanvasElement).width);
  await dialog.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect
    .poll(() =>
      dialog.locator('.file-pdf-page canvas').evaluate((node) => (node as HTMLCanvasElement).width),
    )
    .toBeGreaterThan(before);
  await page.keyboard.press('Escape');
  expect(await dialog.isVisible()).toBe(true);
  expect(await dialog.locator('.file-findbar').count()).toBe(0);
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
});
test('offers Markdown Rendered/Source and searchable script-free DOCX previews', async () => {
  await page.getByRole('button', { name: /^resume.md Markdown/ }).click();
  const markdown = page.getByRole('dialog', { name: 'resume.md', exact: true });
  expect(
    await markdown
      .getByRole('button', { name: 'Rendered', exact: true })
      .getAttribute('aria-pressed'),
  ).toBe('true');
  await markdown.getByRole('button', { name: 'Source', exact: true }).click();
  expect(await markdown.locator('pre').textContent()).toBe(approval.packet.resume);
  await markdown.getByRole('button', { name: 'Next attachment', exact: true }).click();
  await page.getByRole('dialog', { name: 'cover_letter.md', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Previous attachment', exact: true }).click();
  expect(
    await markdown
      .getByRole('button', { name: 'Source', exact: true })
      .getAttribute('aria-pressed'),
  ).toBe('true');
  await page.getByRole('button', { name: 'Close attachment', exact: true }).click();
  await page.getByRole('button', { name: /^resume.docx DOCX/ }).click();
  const docx = page.getByRole('dialog', { name: 'resume.docx', exact: true });
  await docx
    .frameLocator('iframe')
    .getByText('Built React interfaces.', { exact: false })
    .waitFor();
  expect(await docx.locator('iframe').getAttribute('sandbox')).toBe('allow-same-origin');
  await docx.getByRole('button', { name: 'Find', exact: true }).click();
  await docx.getByRole('textbox', { name: 'Find in document' }).fill('React');
  await expect.poll(() => docx.locator('.file-findbar output').textContent()).toBe('1 of 2');
  await page.getByRole('button', { name: 'Close attachment', exact: true }).click();
});
test('keeps manual follow-up after export, enables exact downloads and confirms withdrawal', async () => {
  await page.getByRole('button', { name: 'Approve packet', exact: true }).click();
  await page.getByRole('button', { name: 'Let an agent submit', exact: true }).click();
  expect(await page.getByRole('combobox', { name: 'Submission agent' }).textContent()).toContain(
    'Submitter',
  );
  expect(
    await page.getByRole('button', { name: 'Start preparation', exact: true }).isEnabled(),
  ).toBe(true);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Submit myself', exact: true }).click();
  await page.getByRole('button', { name: 'I’ve submitted', exact: true }).waitFor();
  expect(await page.locator('.mail-subject').textContent()).toContain('Ready for you to submit');
  expect(host.daemon.service.board.get<Card>('card', card.id).state).toBe('awaiting_approval');
  await page.getByRole('button', { name: /^resume.md Markdown/ }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download resume.md', exact: true }).click();
  expect((await downloading).suggestedFilename()).toBe('resume.md');
  await page.getByRole('button', { name: 'Close attachment', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => document.documentElement.setAttribute('data-desktop', 'mac'));
  await page.getByRole('button', { name: /^resume.md Markdown/ }).click();
  const bounds = await page.getByRole('dialog', { name: 'resume.md', exact: true }).boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391);
  expect(bounds!.y).toBeGreaterThanOrEqual(40);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(845);
  await page.getByRole('button', { name: 'Close attachment', exact: true }).click();
  await page.evaluate(() => document.documentElement.removeAttribute('data-desktop'));
  await page.getByRole('button', { name: 'Not applying', exact: true }).click();
  await page.getByRole('button', { name: 'Mark withdrawn', exact: true }).click();
  await expect
    .poll(() => host.daemon.service.board.get<Card>('card', card.id).state)
    .toBe('withdrawn');
  await page
    .getByRole('dialog', { name: 'Not applying to this job?' })
    .waitFor({ state: 'hidden' });
  expect(
    await page.getByRole('region', { name: 'Selected request', exact: true }).isVisible(),
  ).toBe(true);
  expect(await page.getByRole('button', { name: 'I’ve submitted', exact: true }).count()).toBe(0);
  expect(errors).toEqual([]);
});

test('opens the Submitter conversation and verifies its captured outcome there', async () => {
  await host.request(`/cards/${card.id}/status`, 'POST', { state: 'awaiting_approval' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${host.daemon.url}/inbox`);
  await page.getByRole('button', { name: 'Let an agent submit', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Let an agent submit', exact: true }).click();
  await page.getByRole('button', { name: 'Start preparation', exact: true }).click();
  await expect.poll(() => new URL(page.url()).pathname.startsWith('/chat/')).toBe(true);
  const saved = host.daemon.service.board.get<Approval>('approval', approval.id);
  expect(saved.submission?.roleId).toBe('submitter');
  const thread = saved.submission!.threadId!;
  expect(new URL(page.url()).pathname).toBe(`/chat/${thread}`);
  await expect
    .poll(
      () =>
        host.daemon.service.board.get<ChatRequest>('chat_request', saved.submission!.requestId!)
          .deliveries[0]?.status,
      { timeout: 15000 },
    )
    .toBe('completed');
  const runId = host.daemon.service.board.get<ChatRequest>(
    'chat_request',
    saved.submission!.requestId!,
  ).deliveries[0]!.runId!;
  // Frozen fictional receipt fixture; this test never opens or submits an employer form.
  const pageEvidence = {
    url: 'https://example.com/fictional-confirmation',
    title: 'Application received',
    text: 'Your fictional application was received.',
    digest: 'fixture-page',
  };
  const browserApproval: ComputerApproval = {
    id: randomUUID(),
    roleId: 'submitter',
    runId,
    cardId: card.id,
    action: {
      kind: 'click',
      selector: '#submit',
      purpose: 'submission',
      exportApprovalId: approval.id,
    },
    reason: 'Submit fixture application',
    page: { ...pageEvidence, screenshot: '' },
    digest: 'fixture-action',
    status: 'consumed',
    error: '',
    createdAt: new Date().toISOString(),
    decidedAt: new Date().toISOString(),
  };
  const attempt: SubmissionAttempt = {
    id: randomUUID(),
    runId,
    roleId: 'submitter',
    cardId: card.id,
    computerApprovalId: browserApproval.id,
    exportApprovalId: approval.id,
    packetDigest: approval.digest,
    status: 'uncertain',
    before: pageEvidence,
    confirmation: pageEvidence,
    evidence: pageEvidence.text,
    createdAt: new Date().toISOString(),
  };
  host.daemon.service.board.record(
    'computer_approval',
    browserApproval,
    'system',
    'Fictional consumed submission',
  );
  host.daemon.service.board.record(
    'submission_attempt',
    attempt,
    'system',
    'Fictional confirmation evidence',
  );
  host.daemon.service.board.updateCard(
    card.id,
    { submissionAttempts: [attempt] },
    'system',
    'Attach fictional receipt',
  );
  await page.getByText('Outcome needs verification', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Verify later', exact: true }).click();
  expect(host.daemon.service.board.get<Card>('card', card.id).state).toBe('awaiting_approval');
  expect(
    (await host.request(`/approvals/${approval.id}/complete`, 'POST', { state: 'submitted' }))
      .response.status,
  ).toBe(400);
  await page.getByRole('button', { name: 'Verify submission outcome', exact: true }).click();
  await page.getByRole('button', { name: 'I verified submission', exact: true }).click();
  await expect
    .poll(() => host.daemon.service.board.get<Card>('card', card.id).state)
    .toBe('submitted');
  expect(errors).toEqual([]);
}, 60000);
