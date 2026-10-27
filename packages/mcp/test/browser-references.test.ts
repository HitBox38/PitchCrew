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
