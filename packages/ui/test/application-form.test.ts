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
  const host = await setup(24310);
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
  await page.locator(`#board-job-${card.id} .job-card`).waitFor({ timeout: 30000 });
  const later = page.getByRole('button', { name: 'Set up later', exact: true });
  if (await later.isVisible()) await later.click();
  await page.locator(`#board-job-${card.id} .job-card`).click();
  const sheet = page.getByRole('dialog', { name: 'Job details', exact: true });
  await sheet
    .locator('.detail-footer')
    .getByRole('button', { name: 'Inspect application form', exact: true })
    .click();
  const form = sheet.locator('section[aria-label="Application form inspection"]');
  await form.getByRole('button', { name: 'Inspect application form', exact: true }).waitFor();
  await sheet.getByRole('button', { name: 'Prepare brief manually', exact: true }).click();
  const confirm = sheet.getByRole('button', {
    name: 'Confirm complete brief and requirements',
    exact: true,
  });
  expect(await confirm.isDisabled()).toBe(true);
  await sheet.getByRole('checkbox', { name: /I’ll check the form’s required fields/ }).check();
  expect(await confirm.isEnabled()).toBe(true);
  await confirm.click();
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
