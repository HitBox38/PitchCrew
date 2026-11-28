import { chromium, type Browser } from 'playwright';
import { afterEach, expect, test } from 'vitest';
import type { Card } from '@pitchcrew/core';
import { cleanup, setup } from './helpers/daemon.ts';
import { formAssessment } from '../../board/test/fixtures/form.ts';

let browser: Browser | undefined;
afterEach(async () => {
  await browser?.close();
  await cleanup();
});

test('requires form inspection or explicit manual checking, then confirms the actual fields and files before drafting', async () => {
  const host = await setup();
  const card = host.daemon.service.createCard({
    company: 'Fixture Form Studio',
    title: 'Engineer',
    url: 'https://example.com/apply',
  });
  host.daemon.service.moveCard(card.id, 'shortlisted');
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${host.daemon.url}/pipeline`);
  await page.locator(`#board-job-${card.id} .clay-job-card`).waitFor({ timeout: 30000 });
  const later = page.getByRole('button', { name: 'Set up later', exact: true });
  if (await later.isVisible()) await later.click();
  await page.locator(`#board-job-${card.id} .clay-job-card`).click();
  const sheet = page.getByRole('dialog', { name: 'Job details', exact: true });
  const dock = sheet.locator('.detail-footer');
  // With a form-capable agent the dock inspects directly; checking it yourself stays one step away.
  await dock.getByRole('button', { name: 'Inspect application form', exact: true }).waitFor();
  await sheet.getByRole('tab', { name: 'Application', exact: true }).click();
  const form = sheet.locator('section[aria-label="Application form inspection"]');
  await form.getByRole('button', { name: 'Inspect application form', exact: true }).waitFor();
  // Without a brief, automatic extraction leads and explains itself; manual stays available.
  const extraction = sheet.getByRole('region', { name: 'Extract brief from posting' });
  expect(
    await extraction.getByRole('button', { name: 'Extract brief', exact: true }).isVisible(),
  ).toBe(true);
  expect(await sheet.getByRole('button', { name: 'Extract again…', exact: true }).count()).toBe(0);
  expect(
    await sheet.getByRole('button', { name: 'Write it myself', exact: true }).isVisible(),
  ).toBe(true);
  await dock.getByRole('button', { name: 'I’ll check it myself', exact: true }).click();
  // One confirmation, in the dock, beside the brief it confirms.
  expect(
    await sheet.getByRole('button', { name: 'Confirm complete brief and requirements' }).count(),
  ).toBe(0);
  const footerConfirm = dock.getByRole('button', { name: 'Confirm brief', exact: true });
  expect(await footerConfirm.isDisabled()).toBe(true);
  const hint = sheet
    .locator('section[aria-label="Application brief review"]')
    .getByText('Inspect the application form, or choose to check it yourself, before confirming.', {
      exact: true,
    });
  expect(await hint.isVisible()).toBe(true);
  const manual = sheet.getByRole('checkbox', { name: /I’ll check the form’s required fields/ });
  expect(await manual.isChecked()).toBe(false);
  // The box and its wrapping text share one row and one click target.
  const [box, text] = await Promise.all([
    manual.boundingBox(),
    sheet.getByText(/Continue with an uninspected packet/).boundingBox(),
  ]);
  expect(Math.abs((box?.y ?? 0) - (text?.y ?? 100))).toBeLessThan(12);
  await sheet.getByText(/Continue with an uninspected packet/).click();
  expect(await manual.isChecked()).toBe(true);
  expect(await hint.count()).toBe(0);
  expect(await footerConfirm.isEnabled()).toBe(true);
  await footerConfirm.click();
  await expect
    .poll(
      () => host.daemon.service.board.get<Card>('card', card.id).applicationContext?.form?.status,
    )
    .toBe('manual');
  await sheet
    .locator('.detail-footer')
    .getByRole('button', { name: 'Draft application', exact: true })
    .waitFor();
  expect(await form.getByText(/You chose to check the form yourself/).isVisible()).toBe(true);
  host.daemon.service.board.updateCard(
    card.id,
    { formAssessments: [{ ...formAssessment(card.id), id: 'visual-inspection', fields: [] }] },
    'submitter',
    'Inspected a fictional page without structured fields',
  );
  await form.getByText(/No form fields captured/).waitFor();
  expect(await form.getByText(/Use Add requirement in the brief editor/).isVisible()).toBe(true);
  host.daemon.service.board.updateCard(
    card.id,
    { formAssessments: [formAssessment(card.id)] },
    'submitter',
    'Inspected fictional form',
  );
  // Findings that change what the user prepares lead; every field waits behind one disclosure.
  const findings = form.locator('dl.form-findings');
  await findings.getByText('· PDF or DOCX · required', { exact: true }).waitFor();
  // A long answer the user owes carries its length limit once, beside what the form needs.
  expect(
    await findings
      .getByText('· Your motivation · up to 500 characters', { exact: true })
      .isVisible(),
  ).toBe(true);
  expect(await findings.getByText('Length limits', { exact: true }).count()).toBe(0);
  expect(
    await findings.getByText('Questions after the first page', { exact: true }).isVisible(),
  ).toBe(true);
  expect(
    await form.getByText('2 fields, 2 required · example.com/apply', { exact: false }).count(),
  ).toBe(1);
  const fields = form.getByRole('list', { name: 'Inspected fields' });
  expect(await fields.count()).toBe(0);
  expect(await form.getByRole('button', { name: 'Inspect again', exact: true }).isVisible()).toBe(
    true,
  );
  // The brief owns the form summary; it is not repeated as a separate Application section.
  expect(await sheet.getByRole('button', { name: 'Inspected application form' }).count()).toBe(0);
  await sheet
    .locator('.detail-footer')
    .getByRole('button', { name: 'Confirm brief…', exact: true })
    .waitFor();
  // Once a brief exists, re-extraction is a collapsed advanced option.
  expect(await sheet.getByRole('button', { name: 'Extract again…', exact: true }).isVisible()).toBe(
    true,
  );
  expect(await sheet.getByRole('button', { name: 'Extract again', exact: true }).count()).toBe(0);
  // The dock's Review brief opens the brief ready to confirm, with Confirm in the dock.
  await sheet
    .locator('.detail-footer')
    .getByRole('button', { name: 'Confirm brief…', exact: true })
    .click();
  // Confirming adopts every field, so the list is open while the brief is being confirmed.
  expect(
    await fields
      .getByRole('listitem')
      .filter({ hasText: 'Why this team?' })
      .getByText('Long answer · up to 500 · Required', { exact: true })
      .isVisible(),
  ).toBe(true);
  expect(await fields.getByRole('listitem').count()).toBe(2);
  await footerConfirm.click();
  await expect
    .poll(
      () => host.daemon.service.board.get<Card>('card', card.id).applicationContext?.form?.status,
    )
    .toBe('inspected');
  await sheet
    .locator('.detail-footer')
    .getByRole('button', { name: 'Draft application', exact: true })
    .waitFor();
  expect(errors).toEqual([]);
}, 30000);
