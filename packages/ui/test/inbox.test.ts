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
  host = await setup();
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
    .getByRole('heading', { name: 'Approve the Juniper Fixture packet', exact: true })
    .waitFor({ timeout: 30000 });
}, 90000);
afterAll(async () => {
  await browser?.close();
  await cleanup();
});
/** Measures the packet footer's actions: their names, any that leave the footer or viewport or
 * clip their label, and whether the footer itself scrolls to reach them. */
const packetFooterLayout = () =>
  page.locator('footer[aria-label="Packet decision"]').evaluate((footer) => {
    const bounds = footer.getBoundingClientRect();
    const actions = [...footer.querySelectorAll<HTMLElement>('.decide-actions :is(button, a)')];
    const name = (element: HTMLElement) =>
      element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '';
    const outside = (element: HTMLElement) => {
      const box = element.getBoundingClientRect();
      return (
        box.left < Math.max(bounds.left, 0) - 0.5 ||
        box.right > Math.min(bounds.right, innerWidth) + 0.5 ||
        box.top < Math.max(bounds.top, 0) - 0.5 ||
        box.bottom > Math.min(bounds.bottom, innerHeight) + 0.5
      );
    };
    const first = actions[0]?.getBoundingClientRect();
    const row = footer.querySelector('.decide-actions')!.getBoundingClientRect();
    return {
      names: actions.map(name),
      outside: actions.filter(outside).map(name),
      clipped: actions.filter((element) => element.scrollWidth > element.clientWidth + 1).map(name),
      scrolls:
        footer.scrollWidth > footer.clientWidth + 1 ||
        footer.scrollHeight > footer.clientHeight + 1,
      primaryFillsRow: !!first && Math.abs(first.width - row.width) <= 1,
    };
  });
test('shows the waiting packet as a decision with the Reviewer summary before history', async () => {
  const summary = page.getByRole('region', { name: 'Packet summary', exact: true });
  expect(await summary.getByRole('heading', { name: 'Reviewer’s assessment' }).count()).toBe(1);
  expect(await summary.getByRole('heading', { name: 'What to do next' }).count()).toBe(1);
  expect(await page.getByRole('button', { name: /^resume.pdf PDF/ }).count()).toBe(1);
  expect(await page.getByRole('button', { name: /^resume.md Markdown/ }).count()).toBe(1);
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await page.getByText('No packet or browser decisions yet', { exact: true }).waitFor();
  expect(new URL(page.url()).searchParams.get('view')).toBe('history');
  expect(await page.getByRole('heading', { level: 1 }).allTextContents()).toEqual(['Decisions']);
  expect(
    await page.getByRole('button', { name: 'History', exact: true }).getAttribute('aria-pressed'),
  ).toBe('true');
  await page.getByRole('button', { name: /^To decide/ }).click();
  await page
    .getByRole('heading', { name: 'Approve the Juniper Fixture packet', exact: true })
    .waitFor();
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
  await page
    .getByRole('heading', { name: 'Choose how to apply to Juniper Fixture', exact: true })
    .waitFor();
  await page.getByRole('button', { name: 'Let an agent prepare', exact: true }).click();
  expect(await page.getByRole('combobox', { name: 'Submission agent' }).textContent()).toContain(
    'Submitter',
  );
  expect(
    await page.getByRole('button', { name: 'Start preparation', exact: true }).isEnabled(),
  ).toBe(true);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Export to apply myself', exact: true }).click();
  await page.getByRole('button', { name: 'I’ve submitted', exact: true }).waitFor();
  await page
    .getByRole('heading', { name: 'Apply to Juniper Fixture, then record it', exact: true })
    .waitFor();
  expect(await page.locator('.decide-sheet .decide-heading').textContent()).toContain(
    'Ready for you to submit',
  );
  expect(host.daemon.service.board.get<Card>('card', card.id).state).toBe('awaiting_approval');
  await page.getByRole('button', { name: /^resume.md Markdown/ }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download resume.md', exact: true }).click();
  expect((await downloading).suggestedFilename()).toBe('resume.md');
  await page.getByRole('button', { name: 'Close attachment', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // After a manual export every footer action stays whole and reachable on a phone, with
  // I’ve submitted on its own full row; none hides behind a sideways scrollbar.
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await packetFooterLayout()).toEqual({
      names: [
        'I’ve submitted',
        'Open application page',
        'Let an agent prepare',
        'More packet actions',
      ],
      outside: [],
      clipped: [],
      scrolls: false,
      primaryFillsRow: true,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.documentElement.setAttribute('data-desktop', 'mac'));
  await page.getByRole('button', { name: /^resume.md Markdown/ }).click();
  const bounds = await page.getByRole('dialog', { name: 'resume.md', exact: true }).boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391);
  expect(bounds!.y).toBeGreaterThanOrEqual(40);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(845);
  await page.getByRole('button', { name: 'Close attachment', exact: true }).click();
  await page.evaluate(() => document.documentElement.removeAttribute('data-desktop'));
  await page.getByRole('button', { name: 'More packet actions', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Not applying', exact: true }).click();
  await page.getByRole('button', { name: 'Mark withdrawn', exact: true }).click();
  await expect
    .poll(() => host.daemon.service.board.get<Card>('card', card.id).state)
    .toBe('withdrawn');
  await page
    .getByRole('dialog', { name: 'Not applying to this job?' })
    .waitFor({ state: 'hidden' });
  // A withdrawn packet leaves Decisions and is found again by filename in History.
  await page.getByText('No decisions waiting', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search history' }).fill('resume.pdf');
  expect(await page.locator('.decision-history-row').count()).toBe(1);
  await page.getByRole('textbox', { name: 'Search history' }).fill('missing.pdf');
  await page.getByText('No past decisions match.', { exact: true }).waitFor();
  await page.getByRole('textbox', { name: 'Search history' }).fill('');
  await page
    .getByRole('button', { name: /Juniper Fixture/ })
    .first()
    .click();
  const sheet = page.getByRole('article', { name: 'Selected decision', exact: true });
  // The chip shows the decision's own result; the job's current stage stays beside it.
  await sheet
    .locator('.decision-status')
    .filter({ hasText: /^Approved$/ })
    .waitFor();
  expect(await sheet.locator('.decision-stage').textContent()).toBe('Job stage: Withdrawn');
  expect(new URL(page.url()).searchParams.get('entry')).toBe(`packet:${approval.id}`);
  expect(await sheet.getByRole('button', { name: /^resume.pdf PDF/ }).count()).toBe(1);
  expect(await page.getByRole('button', { name: 'I’ve submitted', exact: true }).count()).toBe(0);
  expect(errors).toEqual([]);
});

test('opens the Submitter conversation and verifies its captured outcome there', async () => {
  await host.request(`/cards/${card.id}/status`, 'POST', { state: 'awaiting_approval' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${host.daemon.url}/inbox`);
  await page.getByRole('button', { name: 'Let an agent prepare', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Let an agent prepare', exact: true }).click();
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
  await page
    .getByRole('region', { name: 'Submission outcome', exact: true })
    .getByRole('heading', { name: `Did the ${card.company} application go through?` })
    .waitFor();
  await page.getByRole('button', { name: 'Verify later', exact: true }).click();
  expect(host.daemon.service.board.get<Card>('card', card.id).state).toBe('awaiting_approval');
  expect(
    (await host.request(`/approvals/${approval.id}/complete`, 'POST', { state: 'submitted' }))
      .response.status,
  ).toBe(400);
  await page.getByRole('button', { name: 'Verify submission outcome', exact: true }).click();
  await page.getByRole('button', { name: 'I see the confirmation', exact: true }).click();
  await expect
    .poll(() => host.daemon.service.board.get<Card>('card', card.id).state)
    .toBe('submitted');
  expect(errors).toEqual([]);
}, 60000);

test.each([
  {
    error:
      'page.goto: Timeout 20000ms exceeded.\nCall log:\n\u001b[2m  - navigating to "https://example.com/fictional-application", waiting until "domcontentloaded"\u001b[22m\n',
    diagnostics:
      'page.goto: Timeout 20000ms exceeded.\nCall log:\n  - navigating to "https://example.com/fictional-application", waiting until "domcontentloaded"\n',
    summary: 'You approved this request, but opening the page timed out after 20 seconds.',
  },
  {
    error: 'The page changed. Inspect it and request a new approval.',
    diagnostics: 'The page changed. Inspect it and request a new approval.',
    summary: 'You approved this request, but the browser action failed.',
  },
])(
  'shows approval separately from a saved execution failure with collapsed plain diagnostics: $summary',
  async ({ error, diagnostics, summary }) => {
    const saved: ComputerApproval = {
      id: randomUUID(),
      runId: 'historical-run',
      roleId: 'submitter',
      cardId: card.id,
      action: { kind: 'navigate', url: card.url },
      reason: 'Open the application page for inspection',
      page: { url: 'about:blank', title: '', text: '', screenshot: '', digest: 'historical-page' },
      digest: 'historical-action',
      status: 'failed',
      error,
      createdAt: '2026-11-01T22:33:00.029Z',
      decidedAt: '2026-11-01T22:33:03.000Z',
    };
    host.daemon.service.board.record(
      'computer_approval',
      saved,
      'mcp',
      'Historical execution failure fixture',
    );
    await page.goto(`${host.daemon.url}/inbox?view=history&entry=browser:${saved.id}`);
    const sheet = page.getByRole('article', { name: 'Selected decision' });
    await sheet.getByText('Approved, then failed', { exact: true }).waitFor();
    expect(await sheet.getByRole('alert').textContent()).toBe(summary);
    const errorView = sheet.locator('.browser-approval-error');
    const details = errorView.getByRole('button', { name: 'Details', exact: true });
    expect(await details.getAttribute('aria-expanded')).toBe('false');
    expect(await sheet.innerText()).not.toContain(diagnostics);
    await details.click();
    const source = errorView.getByLabel('Browser execution diagnostics', { exact: true });
    await source.waitFor({ state: 'visible' });
    expect(await source.textContent()).toBe(diagnostics);
    expect(await source.textContent()).not.toContain('\u001b');
    expect(await source.textContent()).not.toMatch(/\[2m|\[22m/);
    expect(await sheet.getByRole('button', { name: /^Approve / }).count()).toBe(0);
    expect(host.daemon.service.board.get<ComputerApproval>('computer_approval', saved.id)).toEqual(
      saved,
    );
  },
);
