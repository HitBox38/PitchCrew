import { chromium } from 'playwright';
import { expect, it } from 'vitest';
import { createBrowserDriver } from '../src/computer/driver.ts';

it('returns optional screenshots and snapshot references, rejects replaced elements and supports bounded waits', async () => {
  const browser = await chromium.launch({ headless: true });
  const driver = await createBrowserDriver(browser);
  const page = browser.contexts()[0].pages()[0];
  try {
    await page.setContent(
      '<input type="password" value="fictional-secret"><button>Continue</button>',
    );
    const first = await driver.snapshot({ includeImage: false, references: true });
    expect(first.screenshot).toBe('');
    expect(first.text).not.toContain('fictional-secret');
    const button = first.elements!.find((element) => element.tag === 'button')!;
    // The user's view of a request names the element as it is now and knows where it sits.
    const target = await driver.describeTarget!(button.ref);
    expect(target).toMatchObject({ tag: 'button', name: 'Continue' });
    expect(target!.bounds!.width).toBeGreaterThan(0);
    expect(await driver.describeTarget!('#not-a-reference')).toBeUndefined();
    // A relabelled element is redacted before it is shortened, so a credential crossing the
    // 120-character cut never survives as a fragment.
    await page
      .locator('button')
      .evaluate((element) => (element.textContent = `${'x'.repeat(110)}fictional-secret`));
    const relabelled = await driver.describeTarget!(button.ref);
    expect(relabelled!.name).not.toContain('fictional');
    expect(relabelled!.name.length).toBeLessThanOrEqual(120);
    await page.locator('button').evaluate((element) => (element.textContent = 'Continue'));
    // The agent's own selector works too, and a field is named by its label, not its value.
    await page.evaluate(() => {
      document.body.insertAdjacentHTML(
        'beforeend',
        '<label>Customer name: <input name="custname" value="private draft"></label>',
      );
    });
    expect(await driver.describeTarget!('input[name="custname"]')).toMatchObject({
      tag: 'input',
      name: 'Customer name',
    });
    expect(await driver.resolveAction!({ kind: 'click', selector: button.ref })).toMatchObject({
      kind: 'click',
      selector: expect.stringContaining(':nth-match'),
    });
    expect(await driver.matches!({ selector: button.ref, text: 'Continue', timeoutMs: 500 })).toBe(
      true,
    );
    await page
      .locator('button')
      .evaluate((element) => element.replaceWith(element.cloneNode(true)));
    await expect(driver.resolveAction!({ kind: 'click', selector: button.ref })).rejects.toThrow(
      'reference changed',
    );
    const second = await driver.snapshot({ includeImage: true, references: true });
    expect(second.screenshot.length).toBeGreaterThan(0);
    await expect(driver.resolveAction!({ kind: 'click', selector: button.ref })).rejects.toThrow(
      'reference expired',
    );
    driver.invalidate!();
    await expect(
      driver.resolveAction!({ kind: 'click', selector: second.elements![0].ref }),
    ).rejects.toThrow('reference expired');
    expect(await driver.matches!({ text: 'Missing', timeoutMs: 500 })).toBe(false);
  } finally {
    await driver.close();
  }
});

it('keeps repeated inspection stable but invalidates document evidence after an identical reload', async () => {
  const browser = await chromium.launch({ headless: true });
  const driver = await createBrowserDriver(browser);
  const context = browser.contexts()[0];
  const page = context.pages()[0];
  try {
    await context.route('https://8.8.8.8/document-generation', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<button>Continue</button>' }),
    );
    await page.goto('https://8.8.8.8/document-generation');
    const first = await driver.snapshot({ includeImage: false });
    expect((await driver.snapshot({ includeImage: false })).digest).toBe(first.digest);
    await page.reload();
    const reloaded = await driver.snapshot({ includeImage: false });
    expect(reloaded.text).toBe(first.text);
    expect(reloaded.digest).not.toBe(first.digest);
  } finally {
    await driver.close();
  }
});
