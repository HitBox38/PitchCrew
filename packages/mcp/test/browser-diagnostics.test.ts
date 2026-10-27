import { chromium } from 'playwright';
import { expect, it } from 'vitest';
import { createBrowserDriver } from '../src/computer/driver.ts';
import { diagnosticMessage, diagnosticUrl } from '../src/computer/diagnostics.ts';

it('bounds and sanitizes browser diagnostics and suppresses private takeover activity', async () => {
  const browser = await chromium.launch({ headless: true });
  const driver = await createBrowserDriver(browser);
  const page = browser.contexts()[0].pages()[0];
  try {
    await page.setContent('<h1>Fixture</h1>');
    await page.evaluate(() => {
      for (let i = 0; i < 50; i++) console.error(`TypeError: Cannot read 'fictional-secret'`);
      console.error('arbitrary private answer');
    });
    const snapshot = await driver.snapshot({ includeImage: false });
    expect(snapshot.diagnostics!.console).toHaveLength(30);
    expect(JSON.stringify(snapshot.diagnostics)).not.toContain('fictional-secret');
    expect(JSON.stringify(snapshot.diagnostics)).not.toContain('arbitrary private answer');
    expect(diagnosticUrl('https://user:secret@example.com/api/jobs?token=private#private')).toBe(
      'https://example.com/api/jobs',
    );
    expect(
      diagnosticMessage('Failed to fetch https://example.com/jobs?token=private'),
    ).not.toContain('private');
    driver.privateControl!(true);
    await page.evaluate(() => console.error('TypeError: private takeover'));
    expect((await driver.snapshot({ includeImage: false })).diagnostics!.console).toEqual([]);
    driver.privateControl!(false);
    expect((await driver.snapshot({ includeImage: false })).diagnostics!.console).toEqual([]);
  } finally {
    await driver.close();
  }
});
