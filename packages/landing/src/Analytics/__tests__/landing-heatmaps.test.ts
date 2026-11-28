import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { expect, it } from 'vitest';

const landingRequire = createRequire(import.meta.url);
const publicUrl = 'https://pitch-crew.tomer-norman.dev/';

it('runs actual landing heatmap, rage/dead-click and consent transport through a safe native SDK', async () => {
  const { stdout: client } = await promisify(execFile)(
    process.env.PITCHCREW_BUN_EXECUTABLE ?? 'bun',
    [
      '--no-env-file',
      '--no-install',
      'build',
      landingRequire.resolve('../client.ts'),
      '--target=browser',
      '--external=posthog-js/*',
      '--define=process.env.NEXT_PUBLIC_POSTHOG_TOKEN="fictional-fixture-token"',
      '--define=process.env.NEXT_PUBLIC_POSTHOG_HOST="https://telemetry.invalid"',
    ],
    { windowsHide: true },
  );
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const captured: { event: string; properties: Record<string, unknown> }[] = [];
  try {
    await page.route('**/*', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const body = request.postDataJSON();
        captured.push(...(body.batch ?? [body]));
        await route.fulfill({ status: 200, body: '{}' });
      } else if (request.url() === 'https://fixture.invalid/client.js') {
        await route.fulfill({ contentType: 'text/javascript', body: client });
      } else if (request.url().startsWith('https://fixture.invalid/'))
        await route.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><body style="height:3000px"><button style="position:absolute;left:80px;top:80px;width:100px;height:80px">private DOM text</button>',
        });
      else await route.fulfill({ status: 200, body: '{}' });
    });
    await page.goto('https://fixture.invalid/?token=private-query#private-hash');
    await page.addScriptTag({
      path: landingRequire.resolve('posthog-js/dist/array.no-external.js'),
    });
    await page.addScriptTag({
      path: landingRequire.resolve('posthog-js/dist/dead-clicks-autocapture.js'),
    });
    await page.addScriptTag({
      content: `
      window.fixtureReady = (async () => {
        const client = await import('/client.js');
        client.sdkConfig.disable_compression = true;
        client.sdkConfig.opt_out_useragent_filter = true;
        window.fixtureAllowed = true;
        window.fixtureAnalytics = client.createAnalytics(async () => window.posthog, () => window.fixtureAllowed);
        await window.fixtureAnalytics.setEnabled(true);
      })();
    `,
    });
    await page.evaluate('window.fixtureReady');
    for (let i = 0; i < 3; i++) await page.mouse.click(100, 100);
    await expect
      .poll(
        () =>
          captured.flatMap(
            (event) =>
              (event.properties?.$heatmap_data as Record<string, { type: string }[]> | undefined)?.[
                publicUrl
              ]?.map((point) => point.type) ?? [],
          ),
        { timeout: 7000 },
      )
      .toEqual(expect.arrayContaining(['click', 'rageclick', 'deadclick']));
    expect(JSON.stringify(captured)).not.toMatch(
      /private-query|private-hash|private DOM text|fixture\.invalid/,
    );
    expect(captured.some((event) => event.event === '$autocapture')).toBe(false);
    expect(captured.some((event) => event.event === '$snapshot')).toBe(false);

    await page.evaluate('window.scrollTo(0, 1200)');
    await expect
      .poll(async () => page.evaluate('window.posthog.scrollManager.getContext().maxScrollY'))
      .toBeGreaterThan(0);
    await page.evaluate("window.posthog.capture('$pageleave')");
    await expect
      .poll(
        () =>
          captured.find((event) => event.event === '$pageleave')?.properties
            .$prev_pageview_max_scroll,
      )
      .toBeGreaterThan(0);

    const beforeOptOut = captured.length;
    // Leave a point buffered, then discard it at consent teardown.
    await page.mouse.click(200, 200);
    await page.evaluate('window.fixtureAllowed = false; window.fixtureAnalytics.setEnabled(false)');
    await page.mouse.click(300, 300);
    await page.waitForTimeout(1300);
    expect(captured).toHaveLength(beforeOptOut);
    await page.evaluate('window.fixtureAllowed = true; window.fixtureAnalytics.setEnabled(true)');
    await page.waitForTimeout(1300);
    const later = captured.slice(beforeOptOut).filter((event) => event.event === '$$heatmap');
    expect(later).toHaveLength(0);
    await page.evaluate('window.fixtureAnalytics.setEnabled(false)');
  } finally {
    await browser.close();
  }
});
