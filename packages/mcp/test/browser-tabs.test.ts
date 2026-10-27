import { chromium } from 'playwright';
import { expect, it } from 'vitest';
import { createBrowserDriver } from '../src/computer/driver.ts';

it('targets exact owned tabs and rejects another session or a closed tab', async () => {
  const browser = await chromium.launch({ headless: true });
  const driver = await createBrowserDriver(browser);
  try {
    const [first] = await driver.tabs!({ kind: 'list' });
    const opened = await driver.tabs!({ kind: 'open' });
    const second = opened.find((tab) => tab.id !== first.id)!;
    expect(second.active).toBe(true);
    expect(
      await driver.resolveAction!({
        kind: 'navigate',
        url: 'https://example.com',
        tabId: first.id,
      }),
    ).toMatchObject({ tabId: first.id });
    expect((await driver.tabs!({ kind: 'list' })).find((tab) => tab.active)!.id).toBe(first.id);
    await expect(driver.targetTab!('another-session')).rejects.toThrow('outside');
    await driver.tabs!({ kind: 'close', tabId: first.id });
    await expect(driver.targetTab!(first.id)).rejects.toThrow('closed');
    const last = await driver.tabs!({ kind: 'close', tabId: second.id });
    expect(last).toHaveLength(1);
    expect(last[0].active).toBe(true);
  } finally {
    await driver.close();
  }
});
