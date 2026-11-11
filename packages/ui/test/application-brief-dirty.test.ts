import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'vitest';
import { jobSourceRevision, saveApplicationContext } from '../../board/src/index.ts';
import type { Card } from '@pitchcrew/core';
import { cleanup, setup } from './helpers/daemon.ts';

let host: Awaited<ReturnType<typeof setup>>;
let browser: Browser;
let page: Page;
let card: Card;
const errors: string[] = [];

beforeAll(async () => {
  host = await setup();
  host.daemon.service.onboarding.save({ version: 1, status: 'dismissed', step: 0 });
  browser = await chromium.launch({ headless: true });
}, 60000);

beforeEach(async () => {
  errors.length = 0;
  page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.message));
  card = host.daemon.service.createCard({
    company: 'JOIN',
    title: 'Fictional Frontend Engineer',
    url: 'https://example.com/apply',
    description: 'Build fictional interfaces.',
  });
  card = saveApplicationContext(
    host.daemon.service.board,
    card.id,
    jobSourceRevision(card),
    null,
    {
      brief: {
        companyContext: 'Fictional employer context.',
        responsibilities: ['Build interfaces.', 'Test interfaces.'],
        qualifications: ['React and TypeScript.'],
        constraints: [],
      },
      requirements: [
        {
          id: 'motivation',
          question: 'Why this role?',
          required: false,
          personal: true,
          answer: '',
        },
      ],
      flagged: [],
    },
    false,
  );
  // Confirmation becomes a decision after shortlisting; leads can check fit first.
  host.daemon.service.moveCard(card.id, 'shortlisted');
  await page.goto(`${host.daemon.url}/inbox?decision=brief-${card.id}`);
  await page.getByRole('heading', { name: 'Confirm the JOIN brief', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Review and confirm', exact: true }).click();
  await page.getByRole('button', { name: 'Review or edit brief', exact: true }).click();
  await page.getByRole('textbox', { name: 'Company context', exact: true }).waitFor();
}, 30000);

afterEach(async () => {
  await page?.close();
});

afterAll(async () => {
  await browser?.close();
  await cleanup();
});

const sheet = () => page.getByRole('dialog', { name: 'Job details', exact: true });
const discard = () => page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true });
const closeUnchanged = async () => {
  await page.keyboard.press('Escape');
  await expect.poll(() => sheet().count()).toBe(0);
  expect(await discard().count()).toBe(0);
  expect(errors).toEqual([]);
};

test('Decisions opens and closes an unchanged, asynchronously loaded brief without a warning', async () => {
  expect(await sheet().getByRole('textbox', { name: 'Company context' }).inputValue()).toBe(
    'Fictional employer context.',
  );
  await closeUnchanged();
});

test('protects actual edits and closes without warning after reverting to the saved value', async () => {
  const context = sheet().getByRole('textbox', { name: 'Company context', exact: true });
  const original = await context.inputValue();
  await context.fill('An unsaved change.');
  await page.keyboard.press('Escape');
  await discard().waitFor();
  await discard().getByRole('button', { name: 'Keep editing', exact: true }).click();
  expect(await context.inputValue()).toBe('An unsaved change.');
  await context.fill(original);
  await closeUnchanged();
});

test('compares normalized list values and restores the baseline on cancel', async () => {
  const responsibilities = sheet().getByRole('textbox', {
    name: 'Responsibilities One item per line',
  });
  await responsibilities.fill('  Build interfaces.  \nTest interfaces.\n');
  expect(await sheet().getByRole('button', { name: 'Edit job', exact: true }).isEnabled()).toBe(
    true,
  );
  await responsibilities.fill('Changed responsibility.');
  await sheet().getByRole('button', { name: 'Cancel editing', exact: true }).click();
  await sheet().getByRole('button', { name: 'Review or edit brief', exact: true }).click();
  expect(await responsibilities.inputValue()).toBe('Build interfaces.\nTest interfaces.');
  await closeUnchanged();
});

test('protects requirement and manual form changes, then clears dirty state after saving', async () => {
  const answer = sheet().getByRole('textbox', { name: 'Your answer', exact: true });
  await answer.fill('A fictional reason.');
  await page.keyboard.press('Escape');
  await discard().waitFor();
  await discard().getByRole('button', { name: 'Keep editing', exact: true }).click();
  await answer.fill('');
  const manual = sheet().getByRole('checkbox', { name: /I’ll check the form’s required fields/ });
  await manual.check();
  await page.keyboard.press('Escape');
  await discard().waitFor();
  await discard().getByRole('button', { name: 'Keep editing', exact: true }).click();
  await manual.uncheck();
  expect(await sheet().getByRole('button', { name: 'Edit job', exact: true }).isEnabled()).toBe(
    true,
  );
  await manual.check();
  await answer.fill('A fictional reason.');
  const context = sheet().getByRole('textbox', { name: 'Company context', exact: true });
  await context.fill('  Saved employer context.  ');
  await sheet()
    .getByRole('button', { name: 'Confirm complete brief and requirements', exact: true })
    .click();
  await sheet().getByRole('button', { name: 'Review or edit brief', exact: true }).waitFor();
  const saved = host.daemon.service.board.get<Card>('card', card.id).applicationContext!;
  expect(saved.confirmedAt).toBeTruthy();
  expect(saved.requirements[0]!.answer).toBe('A fictional reason.');
  expect(saved.form).toEqual({ status: 'manual' });
  expect(saved.brief.companyContext).toBe('Saved employer context.');
  await sheet().getByRole('button', { name: 'Review or edit brief', exact: true }).click();
  expect(await answer.inputValue()).toBe('A fictional reason.');
  expect(await context.inputValue()).toBe('Saved employer context.');
  await context.fill('Fictional employer context.');
  await page.keyboard.press('Escape');
  await discard().waitFor();
  await discard().getByRole('button', { name: 'Keep editing', exact: true }).click();
  await context.fill('Saved employer context.');
  await closeUnchanged();
});
