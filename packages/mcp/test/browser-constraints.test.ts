import { chromium } from 'playwright';
import { expect, it, vi } from 'vitest';
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
      expect(field.buttonType).toEqual(control.buttonType);
      expect(field.assessed).toBe(true);
      expect(await page.locator(control.selector).count()).toBe(1);
    }
    expect(JSON.stringify(form)).not.toContain('Private draft');
    expect(JSON.stringify(form)).not.toContain('selector');
    for (const control of [
      ...assessment.fields,
      ...(assessment.page.controls ?? []),
      ...form.fields,
    ]) {
      expect(control).not.toHaveProperty('checked');
      expect(control).not.toHaveProperty('pressed');
    }
    const initialDigest = snapshot.digest;
    await page.getByRole('button', { name: 'Selected toggle', exact: true }).evaluate((element) => {
      element.setAttribute('aria-pressed', 'false');
    });
    const changedState = await driver.snapshot({ includeImage: false });
    expect(
      changedState.controls?.find((control) => control.label === 'Selected toggle')?.pressed,
    ).toBe(false);
    expect(changedState.digest).not.toBe(initialDigest);
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

it('keeps main-document field evidence when a widget contains a second body or page text is unavailable', async () => {
  const browser = await chromium.launch({ headless: true });
  const driver = await createBrowserDriver(browser);
  const page = browser.contexts()[0].pages()[0];
  try {
    await page.setContent(
      '<label>Work sample<input required maxlength="80"></label><div id="widget"></div>',
    );
    await page.locator('#widget').evaluate((el) => {
      el.attachShadow({ mode: 'open' }).append(document.createElement('body'));
    });
    expect(await page.locator('body').count()).toBe(2);
    const snapshot = await driver.snapshot({ includeImage: false });
    expect(snapshot.uninspected).toEqual([]);
    expect(snapshot.text).toContain('Work sample');
    expect(snapshot.controls).toMatchObject([
      { label: 'Work sample', required: true, maxLength: 80 },
    ]);

    const root = page.mainFrame().locator(':root');
    vi.spyOn(root, 'ariaSnapshot').mockRejectedValue(new Error('Text unavailable'));
    const locate = page.mainFrame().locator.bind(page.mainFrame());
    vi.spyOn(page.mainFrame(), 'locator').mockImplementation((selector, options) =>
      selector === ':root' ? root : locate(selector, options),
    );
    const partial = await driver.snapshot({ includeImage: false });
    expect(partial.controls).toEqual(snapshot.controls);
    expect(partial.uninspected).toContain('Unavailable frame text: about:blank');
  } finally {
    await driver.close();
  }
});
