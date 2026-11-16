import { chromium } from 'playwright';
import { expect, it } from 'vitest';
import { Board } from '@pitchcrew/board';
import { cardInput, inspectedApplicationForm, type FormAssessment } from '@pitchcrew/core';
import { createBrowserDriver } from '../src/computer/driver.ts';
import { saveAssessment } from '../src/computer/submissions.ts';
import { assertFormConstraints, formConstraintsHtml } from './fixtures/form-constraints.ts';

it('inspects bounded declared constraints and semantic groups, persists them without private values', async () => {
  const browser = await chromium.launch({ headless: true });
  const driver = await createBrowserDriver(browser);
  const page = browser.contexts()[0].pages()[0];
  const board = new Board(':memory:');
  try {
    await page.setContent(formConstraintsHtml);
    const snapshot = await driver.snapshot({ includeImage: false });
    assertFormConstraints(snapshot);
    const card = board.createCard(cardInput.parse({ company: 'Fictional', title: 'Engineer' }));
    const assessment = saveAssessment(
      board,
      { cardId: card.id, roleId: 'submitter', runId: 'fixture' },
      snapshot,
      { fields: snapshot.controls!.map(({ selector }) => ({ selector })) },
    );
    const form = inspectedApplicationForm({ formAssessments: [assessment] });
    expect(form?.status).toBe('inspected');
    if (form?.status !== 'inspected') throw new Error('Expected inspected requirements');
    for (const [index, field] of form.fields.entries()) {
      const control = snapshot.controls![index]!;
      expect(field.constraints).toEqual(control.constraints);
      expect(field.group).toEqual(control.group);
      expect(field.optionsTotal).toEqual(control.optionsTotal);
      expect(field.optionsTruncated).toEqual(control.optionsTruncated);
      expect(field.assessed).toBe(true);
      expect(await page.locator(control.selector).count()).toBe(1);
    }
    expect(JSON.stringify(form)).not.toContain('Private draft');
    expect(JSON.stringify(form)).not.toContain('selector');
    board.rebuild();
    expect(board.get<FormAssessment>('form_assessment', assessment.id)).toEqual(assessment);
    await page.locator('#summary').evaluate((field) => {
      field.setAttribute('minlength', '21');
    });
    expect((await driver.snapshot({ includeImage: false })).digest).not.toBe(snapshot.digest);
  } finally {
    board.close();
    await driver.close();
  }
});

it('retains frame selectors and reports control overflow without claiming completeness', async () => {
  const browser = await chromium.launch({ headless: true });
  const driver = await createBrowserDriver(browser);
  const page = browser.contexts()[0].pages()[0];
  try {
    await page.setContent('<iframe></iframe>' + '<input>'.repeat(101));
    await page
      .frames()[1]!
      .setContent('<label>Frame score<input type="number" min="1" max="5" step="any"></label>');
    const snapshot = await driver.snapshot({ includeImage: false });
    expect(snapshot.controls).toHaveLength(101);
    const field = snapshot.controls!.find((control) => control.label === 'Frame score')!;
    expect(field).toMatchObject({
      frame: expect.any(String),
      constraints: { step: { status: 'declared', value: 'any' } },
    });
    expect(snapshot.uninspected).toContain('More than 100 controls in about:blank');
    expect(await page.frameLocator(field.frame!).locator(field.selector).count()).toBe(1);
  } finally {
    await driver.close();
  }
});
