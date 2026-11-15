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
  await page.goto(host.daemon.url);
  await page.locator(`#board-job-${card.id} .clay-job-card`).waitFor({ timeout: 30000 });
  const later = page.getByRole('button', { name: 'Set up later', exact: true });
  if (await later.isVisible()) await later.click();
  await page.locator(`#board-job-${card.id} .clay-job-card`).click();
  const sheet = page.getByRole('dialog', { name: 'Job details', exact: true });
  await sheet
    .locator('.detail-footer')
    .getByRole('button', { name: 'Inspect application form', exact: true })
    .click();
  const form = sheet.locator('section[aria-label="Application form inspection"]');
  await form.getByRole('button', { name: 'Inspect application form', exact: true }).waitFor();
  // Without a brief, automatic extraction leads and explains itself; manual stays available.
  const extraction = sheet.getByRole('region', { name: 'Extract brief from posting' });
  expect(await extraction.getByRole('button', { name: 'Extract from source' }).isVisible()).toBe(
    true,
  );
  expect(await sheet.getByRole('button', { name: 'Extract again from source' }).count()).toBe(0);
  await sheet.getByRole('button', { name: 'Prepare brief manually', exact: true }).click();
  const confirm = sheet.getByRole('button', {
    name: 'Confirm complete brief and requirements',
    exact: true,
  });
  expect(await confirm.isDisabled()).toBe(true);
  const footerConfirm = sheet
    .locator('.detail-footer')
    .getByRole('button', { name: 'Confirm brief', exact: true });
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
  expect(await confirm.isEnabled()).toBe(true);
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
    { formAssessments: [formAssessment(card.id)] },
    'submitter',
    'Inspected fictional form',
  );
  await form.getByText('Accepted files: .pdf,.docx', { exact: true }).waitFor();
  expect(await form.getByText('Maximum length: 500 characters', { exact: true }).isVisible()).toBe(
    true,
  );
  expect(
    await form
      .getByText('Uninspected: Questions after the first page', { exact: true })
      .isVisible(),
  ).toBe(true);
  await sheet
    .locator('.detail-footer')
    .getByRole('button', { name: 'Review brief', exact: true })
    .waitFor();
  // Once a brief exists, re-extraction is a collapsed advanced option.
  expect(await sheet.getByRole('button', { name: 'Extract again from source' }).isVisible()).toBe(
    true,
  );
  expect(await sheet.getByRole('button', { name: 'Extract again', exact: true }).count()).toBe(0);
  await sheet.getByRole('button', { name: 'Review or edit brief', exact: true }).click();
  await confirm.click();
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
