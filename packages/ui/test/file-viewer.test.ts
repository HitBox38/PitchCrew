import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { Card, Run } from '@pitchcrew/core';
import { setup, cleanup, confirmFixtureApplication, finish } from './helpers/daemon.ts';
let host: Awaited<ReturnType<typeof setup>>;
let browser: Browser;
let page: Page;
const errors: string[] = [];

beforeAll(async () => {
  host = await setup();
  await host.request('/profile', 'PUT', {
    name: 'profile.md',
    content: '# Example Candidate\n\n- Built React interfaces.\n',
  });
  const { result: card } = await host.request<Card>('/cards', 'POST', {
    company: 'Juniper Fixture',
    title: 'React Engineer',
    description: 'Build React interfaces.',
    url: 'https://example.com/fictional-application',
  });
  await confirmFixtureApplication(host.request, card.id);
  await host.request(`/cards/${card.id}/move`, 'POST', { state: 'shortlisted' });
  for (const roleId of ['writer', 'reviewer']) {
    const { result: run } = await host.request<Run>(`/cards/${card.id}/run`, 'POST', { roleId });
    await finish(host.request, run.id);
  }
  await host.request(`/cards/${card.id}/approval`, 'POST', { formats: ['pdf', 'docx'] });
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(15000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${host.daemon.url}/inbox`);
  await page.getByRole('button', { name: 'Set up later', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Approve the Juniper Fixture packet', exact: true })
    .waitFor({ timeout: 30000 });
}, 90000);
afterAll(async () => {
  await browser?.close();
  await cleanup();
});

/** The toolbar's controls: any that wrap off its first row, clip their label or leave it. */
const toolbarLayout = () =>
  page.locator('.file-toolbar').evaluate((toolbar) => {
    const bounds = toolbar.getBoundingClientRect();
    const controls = [...toolbar.querySelectorAll<HTMLElement>('button, input')].filter(
      (element) => element.offsetParent,
    );
    const name = (element: HTMLElement) =>
      element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '';
    const first = controls[0]!.getBoundingClientRect();
    return {
      height: Math.round(bounds.height),
      wrapped: controls
        .filter((element) => element.getBoundingClientRect().top > first.bottom)
        .map(name),
      outside: controls
        .filter((element) => {
          const box = element.getBoundingClientRect();
          return box.left < bounds.left - 0.5 || box.right > bounds.right + 0.5;
        })
        .map(name),
      clipped: controls
        .filter((element) => element.scrollWidth > element.clientWidth + 1)
        .map(name),
    };
  });
const open = async (name: string, kind: string) => {
  await page
    .getByRole('button', { name: new RegExp(`^${name.replace('.', '\\.')} ${kind}`) })
    .click();
  const dialog = page.getByRole('dialog', { name, exact: true });
  await dialog.waitFor();
  return dialog;
};

test('keeps every toolbar control on one row from wide desktops down to small laptops', async () => {
  for (const width of [1440, 1180, 900]) {
    await page.setViewportSize({ width, height: 800 });
    for (const [name, kind] of [
      ['resume.pdf', 'PDF'],
      ['resume.docx', 'DOCX'],
      ['resume.md', 'Markdown'],
    ] as const) {
      const dialog = await open(name, kind);
      expect(await toolbarLayout(), `${name} at ${width}px`).toEqual({
        height: 44,
        wrapped: [],
        outside: [],
        clipped: [],
      });
      await dialog.getByRole('button', { name: 'Close viewer', exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
});

/** The zoom button's percentage as a number. */
const shown = async (dialog: ReturnType<Page['getByRole']>) =>
  Number((await dialog.getByRole('button', { name: /^Zoom, / }).textContent())!.slice(0, -1));
/** A Letter page is 8.5in: 816 CSS pixels at its printed size. */
const letter = 816;

test('shows the zoom on screen, fits PDFs automatically and resets to printed size', async () => {
  const dialog = await open('resume.pdf', 'PDF');
  await dialog.locator('.file-pdf-page canvas').waitFor();
  const sheet = () => dialog.locator('.file-pdf-page').evaluate((node) => node.clientWidth);
  // Automatic fits the width but never enlarges a portrait page past 125% of its printed size,
  // and the percentage shown is the page's real size.
  await expect.poll(() => shown(dialog)).toBeGreaterThan(50);
  const automatic = await shown(dialog);
  expect(automatic).toBeLessThanOrEqual(125);
  expect(Math.abs((await sheet()) - (letter * automatic) / 100)).toBeLessThan(letter * 0.01);
  // A one-page PDF needs no page navigation; its facts say how long it is.
  expect(await dialog.locator('.file-page-pill').count()).toBe(0);
  expect(await dialog.locator('.file-toolbar-facts').innerText()).toBe('PDF · 1 page');
  await dialog.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect.poll(() => shown(dialog)).toBeGreaterThan(automatic);
  await dialog.getByRole('button', { name: /^Zoom, / }).click();
  await page.getByRole('menuitem', { name: /^Reset zoom/ }).click();
  await expect.poll(() => shown(dialog)).toBe(100);
  await expect.poll(sheet).toBe(letter);
  await dialog.getByRole('button', { name: /^Zoom, / }).click();
  await page.getByRole('menuitemradio', { name: 'Fit width', exact: true }).click();
  const tray = await dialog.locator('.file-view-body').evaluate((node) => node.clientWidth);
  await expect.poll(sheet).toBeGreaterThan(tray - 80);
  expect(await sheet()).toBeLessThanOrEqual(tray);
  await dialog.getByRole('button', { name: 'Close viewer', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
});

test('shows PDF and Word pages at the same printed size for the same percentage', async () => {
  const widths: number[] = [];
  for (const [name, kind, selector] of [
    ['resume.pdf', 'PDF', '.file-pdf-page'],
    ['resume.docx', 'DOCX', ''],
  ] as const) {
    const dialog = await open(name, kind);
    await dialog.getByRole('button', { name: /^Zoom, / }).click();
    await page.getByRole('menuitem', { name: /^Reset zoom/ }).click();
    await expect.poll(() => shown(dialog)).toBe(100);
    widths.push(
      selector
        ? await dialog.locator(selector).evaluate((node) => node.getBoundingClientRect().width)
        : await dialog.locator('iframe').evaluate((frame: HTMLIFrameElement) => {
            const section = frame.contentDocument!.querySelector('section.docx')!;
            return section.getBoundingClientRect().width;
          }),
    );
    await dialog.getByRole('button', { name: 'Close viewer', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
  }
  expect(Math.abs(widths[0]! - widths[1]!)).toBeLessThan(2);
  expect(Math.abs(widths[0]! - letter)).toBeLessThan(2);
});

test('states the Word layout notice once instead of a layout note on every Word file', async () => {
  // Tiles and the file column carry no note for the shared Word caveat.
  expect(await page.locator('.file-tile[data-kind="docx"] .file-tile-notes').count()).toBe(0);
  const check = page.locator('.packet-findings');
  const heading = await check.locator('[data-slot="accordion-trigger"]').innerText();
  expect(heading).toMatch(/documents checked/);
  expect(heading).not.toMatch(/layout note/);
  await check.locator('[data-slot="accordion-trigger"]').click();
  expect(
    await check.getByText('Browser preview: Word’s layout and page count may differ.').count(),
  ).toBe(1);
  expect(await check.getByText(/Word controls final DOCX layout/).count()).toBe(0);
  await check.locator('[data-slot="accordion-trigger"]').click();
  const dialog = await open('resume.docx', 'DOCX');
  expect(await dialog.locator('.file-view-list .file-note-dot').count()).toBe(0);
  expect(await dialog.locator('.file-layout-notes').count()).toBe(0);
  expect(
    await dialog.getByText('Browser preview: Word’s layout and page count may differ.').count(),
  ).toBe(1);
  // Request attachments say viewing a file neither approves the request nor exports it.
  const description = await dialog.getAttribute('aria-describedby');
  expect(await page.locator(`[id="${description}"]`).textContent()).toBe(
    'Read-only attachment viewer. Viewing a file does not approve the request or export it.',
  );
  await dialog.getByRole('button', { name: 'Close viewer', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
});

test('closes a menu, then Find, then the viewer on Escape, returning focus to Find', async () => {
  const dialog = await open('resume.md', 'Markdown');
  // Viewer shortcuts belong to the dialog, so wait for it to take focus as a reader would.
  await expect
    .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
    .toBe(true);
  await page.keyboard.press('ControlOrMeta+f');
  await dialog.getByRole('textbox', { name: 'Find in document' }).fill('React');
  expect(await dialog.locator('.file-findbar-scope').textContent()).toBe('Rendered');
  await expect.poll(() => dialog.locator('.file-findbar output').textContent()).toBe('1 of 2');
  await dialog.getByRole('button', { name: 'More file controls', exact: true }).click();
  await page.getByRole('menu').waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('menu').waitFor({ state: 'detached' });
  expect(await dialog.locator('.file-findbar').count()).toBe(1);
  await dialog.getByRole('textbox', { name: 'Find in document' }).focus();
  await page.keyboard.press('Escape');
  expect(await dialog.locator('.file-findbar').count()).toBe(0);
  // Highlights only show while Find is open.
  expect(await page.evaluate(() => CSS.highlights.get('file-matches')?.size ?? 0)).toBe(0);
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.getAttribute('aria-label')))
    .toBe('Find');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  expect(errors).toEqual([]);
});

test('reads a short Word letter at full page width on a short laptop screen', async () => {
  await page.setViewportSize({ width: 1180, height: 600 });
  const dialog = await open('cover_letter.docx', 'DOCX');
  await dialog.frameLocator('iframe').locator('section.docx').waitFor();
  // Orientation comes from the declared page, not the letter's short content.
  await expect
    .poll(async () =>
      Number((await dialog.getByRole('button', { name: /^Zoom, / }).textContent())!.slice(0, -1)),
    )
    .toBeGreaterThanOrEqual(100);
  const sheet = await dialog.locator('iframe').evaluate((frame: HTMLIFrameElement) => {
    const section = frame.contentDocument!.querySelector<HTMLElement>('section.docx')!;
    return section.offsetHeight / section.offsetWidth;
  });
  expect(sheet).toBeGreaterThan(1.2);
  await dialog.getByRole('button', { name: 'Close viewer', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
  await page.setViewportSize({ width: 1440, height: 900 });
});

test('keeps Find and zoom when the reader re-selects the open file or zooms mid-search', async () => {
  const dialog = await open('resume.pdf', 'PDF');
  await dialog.locator('.file-pdf-page canvas').waitFor();
  await dialog.getByRole('button', { name: 'Find', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Find in document' }).fill('React');
  await expect.poll(() => dialog.locator('.file-findbar output').textContent()).toBe('1 of 2');
  await dialog.getByRole('button', { name: 'Next match', exact: true }).click();
  await expect.poll(() => dialog.locator('.file-findbar output').textContent()).toBe('2 of 2');
  const zoom = await dialog.getByRole('button', { name: /^Zoom, / }).textContent();
  await dialog
    .getByRole('navigation', { name: 'Attachments' })
    .getByRole('button', { name: 'resume.pdf', exact: true })
    .click();
  expect(await dialog.locator('.file-findbar output').textContent()).toBe('2 of 2');
  expect(await dialog.getByRole('button', { name: /^Zoom, / }).textContent()).toBe(zoom);
  // Zoom swaps every text layer; the reader stays on the match they chose.
  await dialog.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.waitForTimeout(400);
  await expect.poll(() => dialog.locator('.file-findbar output').textContent()).toBe('2 of 2');
  await dialog.getByRole('button', { name: 'Close viewer', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
});

test('scrolls a Word preview from the keyboard as soon as it opens', async () => {
  const dialog = await open('cover_letter.docx', 'DOCX');
  await dialog.frameLocator('iframe').locator('section.docx').waitFor();
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.getAttribute('aria-label')))
    .toBe('cover_letter.docx contents');
  const scrolled = () =>
    dialog
      .locator('iframe')
      .evaluate((frame: HTMLIFrameElement) => frame.contentDocument!.scrollingElement!.scrollTop);
  expect(await scrolled()).toBe(0);
  await page.keyboard.press('PageDown');
  await expect.poll(scrolled).toBeGreaterThan(0);
  await dialog.getByRole('button', { name: 'Close viewer', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
});

test('keeps every toolbar control reachable and touch-sized on tablets', async () => {
  const context = await browser.newContext({
    viewport: { width: 800, height: 1000 },
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  const tablet = await context.newPage();
  tablet.setDefaultTimeout(15000);
  await tablet.goto(`${host.daemon.url}/inbox`);
  await tablet
    .getByRole('button', { name: 'Set up later', exact: true })
    .click({ timeout: 10000 })
    .catch(() => {});
  for (const width of [768, 800, 820, 990, 1100]) {
    await tablet.setViewportSize({ width, height: 1000 });
    for (const [name, kind] of [
      ['resume.pdf', 'PDF'],
      ['resume.md', 'Markdown'],
    ] as const) {
      await tablet
        .getByRole('button', { name: new RegExp(`^${name.replace('.', '\\.')} ${kind}`) })
        .click();
      const dialog = tablet.getByRole('dialog', { name, exact: true });
      await dialog.waitFor();
      const problems = await dialog.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return [...element.querySelectorAll<HTMLElement>('.file-toolbar :is(button, input)')]
          .filter((control) => control.offsetParent)
          .flatMap((control) => {
            const box = control.getBoundingClientRect();
            const label = control.getAttribute('aria-label') ?? control.textContent?.trim();
            return [
              ...(box.left < bounds.left - 0.5 || box.right > bounds.right + 0.5
                ? [`${label} outside`]
                : []),
              ...(box.height < 43.5 || box.width < 43.5 ? [`${label} under 44px`] : []),
              ...(control.scrollWidth > control.clientWidth + 1 ? [`${label} clipped`] : []),
            ];
          });
      });
      expect(problems, `${name} at ${width}px`).toEqual([]);
      // Two-row tablets keep the zoom steps on the toolbar (a one-row touch toolbar sheds them).
      if (width < 1000)
        expect(await dialog.getByRole('button', { name: 'Zoom in', exact: true }).isVisible()).toBe(
          true,
        );
      if (width === 1100) {
        const rows = await dialog
          .locator('.file-view-list > button')
          .evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height));
        expect(Math.min(...rows), 'file column rows on touch').toBeGreaterThanOrEqual(44);
      }
      if (name === 'resume.pdf' && width >= 800) {
        // The taller touch Find pill still clears the top of page 1 at rest.
        await dialog.locator('.file-pdf-page canvas').waitFor();
        await dialog.getByRole('button', { name: 'Find', exact: true }).click();
        const gap = await dialog.evaluate((element) => {
          const pill = element.querySelector('.file-findbar')!.getBoundingClientRect();
          return element.querySelector('.file-pdf-page')!.getBoundingClientRect().top - pill.bottom;
        });
        expect(gap, `Find pill gap at ${width}px`).toBeGreaterThan(0);
        await tablet.keyboard.press('Escape');
      }
      await dialog.getByRole('button', { name: 'Close viewer', exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
    }
  }
  await context.close();
});

test('clears a stale copy error once a copy succeeds', async () => {
  const dialog = await open('resume.md', 'Markdown');
  const notice = dialog.locator('.file-view-notice');
  await dialog.getByRole('button', { name: 'More file controls', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Copy selection' }).click();
  await notice.getByText('Select document text to copy.').waitFor();
  await dialog.getByRole('button', { name: 'More file controls', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Copy Markdown' }).click();
  await expect.poll(() => notice.getByText('Select document text to copy.').count()).toBe(0);
  await dialog.getByRole('button', { name: 'Close viewer', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
});

test('keeps every phone toolbar control inside a 320px screen', async () => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const [name, kind] of [
    ['resume.md', 'Markdown'],
    ['resume.docx', 'DOCX'],
    ['resume.pdf', 'PDF'],
  ] as const) {
    const dialog = await open(name, kind);
    const outside = await dialog.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return [...element.querySelectorAll<HTMLElement>('.file-toolbar :is(button, input)')]
        .filter((control) => control.offsetParent)
        .filter((control) => {
          const box = control.getBoundingClientRect();
          return (
            box.left < bounds.left - 0.5 ||
            box.right > bounds.right + 0.5 ||
            box.height < 43.5 ||
            box.width < 43.5
          );
        })
        .map((control) => control.getAttribute('aria-label') ?? control.textContent?.trim());
    });
    expect(outside, name).toEqual([]);
    await dialog.getByRole('button', { name: 'Close viewer', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
});

test('keeps Word Preview on Automatic when Source resets its text size', async () => {
  const dialog = await open('resume.docx', 'DOCX');
  await dialog.frameLocator('iframe').locator('section.docx').waitFor();
  await expect.poll(() => shown(dialog)).toBeGreaterThan(50);
  const automatic = await shown(dialog);
  await dialog.getByRole('button', { name: 'Source', exact: true }).click();
  // Source reads at the 16px reading size at 100%.
  expect(await dialog.locator('pre').evaluate((node) => getComputedStyle(node).fontSize)).toBe(
    '16px',
  );
  await dialog.getByRole('button', { name: /^Zoom, / }).click();
  await page.getByRole('menuitem', { name: /^Reset zoom/ }).click();
  await dialog.getByRole('button', { name: 'Preview', exact: true }).click();
  await dialog.frameLocator('iframe').locator('section.docx').waitFor();
  await expect.poll(() => shown(dialog)).toBe(automatic);
  await dialog.getByRole('button', { name: 'Close viewer', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
});

test('keeps a Word page’s proportion on a phone', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  const dialog = await open('cover_letter.docx', 'DOCX');
  await dialog.frameLocator('iframe').locator('section.docx').waitFor();
  await expect
    .poll(() =>
      dialog.locator('iframe').evaluate((frame: HTMLIFrameElement) => {
        const section = frame.contentDocument!.querySelector<HTMLElement>('section.docx')!;
        return section.offsetHeight / section.offsetWidth;
      }),
    )
    .toBeGreaterThan(1.25);
  // Reflowed pages have nothing to fit: the menu offers text sizes only, and they stay in the frame.
  await dialog.getByRole('button', { name: /^Zoom, / }).click();
  await page.getByRole('menuitemradio', { name: '150%' }).waitFor();
  expect(await page.getByRole('menuitemradio', { name: /^(Automatic|Fit width)$/ }).count()).toBe(
    0,
  );
  await expect.poll(() => page.getByText('Text size', { exact: true }).isVisible()).toBe(true);
  await page.getByRole('menuitemradio', { name: '150%' }).click();
  await expect.poll(() => shown(dialog)).toBe(150);
  const fits = await dialog.locator('iframe').evaluate((frame: HTMLIFrameElement) => {
    const section = frame.contentDocument!.querySelector<HTMLElement>('section.docx')!;
    return section.getBoundingClientRect().right <= frame.clientWidth + 0.5;
  });
  expect(fits).toBe(true);
  await dialog.getByRole('button', { name: 'Close viewer', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
  await page.setViewportSize({ width: 1440, height: 900 });
});
