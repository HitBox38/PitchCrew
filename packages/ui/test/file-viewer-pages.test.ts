import { fileURLToPath } from 'node:url';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, test } from 'vitest';

let server: ViteDevServer;
let browser: Browser;
let page: Page;
let cache: string;
let origin: string;
let files: unknown[];
const errors: string[] = [];

/** Prints fictional HTML to PDF bytes with Chromium, as a packet renderer would. */
const printPdf = async (html: string, landscape = false) => {
  const printer = await browser.newPage();
  await printer.setContent(html);
  const bytes = await printer.pdf({ format: 'Letter', landscape, preferCSSPageSize: true });
  await printer.close();
  return bytes.toString('base64');
};

beforeAll(async () => {
  cache = await mkdtemp(join(tmpdir(), 'pitchcrew-file-viewer-cache-'));
  server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
    cacheDir: cache,
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 0 },
    plugins: [
      {
        name: 'file-viewer-fixture',
        configureServer: (vite) => {
          vite.middlewares.use('/__file-viewer', async (_request, response) => {
            response.setHeader('Content-Type', 'text/html');
            response.end(
              await vite.transformIndexHtml(
                '/__file-viewer',
                '<html><body><div id="root"></div><script type="module" src="/test/fixtures/file-viewer.tsx"></script></body></html>',
              ),
            );
          });
        },
      },
    ],
  });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === 'string') throw new Error('No test server address');
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
  const section = (index: number) =>
    `<h2>Role ${index}</h2><p>${'Built fictional React interfaces for a booking platform. '.repeat(30)}</p>`;
  files = [
    {
      id: 'long',
      name: 'long-resume.pdf',
      kind: 'pdf',
      findings: [
        { severity: 'warn', check: 'layout', message: 'Large gap before Role 4.', page: 2 },
        { severity: 'error', check: 'content', message: 'Expected heading not found.' },
      ],
      mimeType: 'application/pdf',
      bytes: await printPdf(
        `<h1>Example Candidate</h1>${Array.from({ length: 12 }, (_, i) => section(i + 1)).join('')}`,
      ),
      downloadAllowed: true,
    },
    {
      id: 'wide',
      name: 'portfolio-sheet.pdf',
      kind: 'pdf',
      mimeType: 'application/pdf',
      bytes: await printPdf('<h1>Fictional portfolio sheet</h1>', true),
      downloadAllowed: true,
    },
    {
      id: 'mixed',
      name: 'mixed-pages.pdf',
      kind: 'pdf',
      mimeType: 'application/pdf',
      bytes: await printPdf(
        '<style>@page { size: 8.5in 11in } @page wide { size: 11in 8.5in } .wide { page: wide }</style><h1>Portrait cover</h1><h1 class="wide">Landscape table</h1>',
      ),
      downloadAllowed: true,
    },
    {
      id: 'notes',
      name: 'notes.md',
      kind: 'markdown',
      mimeType: 'text/markdown;charset=utf-8',
      text: '# Example Candidate\n\nBuilt React\n\nEngineer team.\n\n| Skill | Years |\n|---|---|\n| React | 8 |\n\n```ts\nconst answer = 42;\n```\n',
      downloadAllowed: false,
    },
    {
      id: 'shot',
      name: 'captured-page.png',
      kind: 'image',
      mimeType: 'image/png',
      bytes: await (async () => {
        const camera = await browser.newPage({ viewport: { width: 900, height: 700 } });
        await camera.setContent('<h1 style="font:40px sans-serif">Fictional captured page</h1>');
        const shot = (await camera.screenshot()).toString('base64');
        await camera.close();
        return shot;
      })(),
      downloadAllowed: true,
    },
    {
      id: 'broken',
      name: 'broken.pdf',
      kind: 'pdf',
      mimeType: 'application/pdf',
      bytes: Buffer.from('not a pdf').toString('base64'),
      downloadAllowed: true,
    },
    {
      id: 'broken-image',
      name: 'broken-capture.png',
      kind: 'image',
      mimeType: 'image/png',
      bytes: Buffer.from('not an image').toString('base64'),
      downloadAllowed: true,
    },
    {
      id: 'long-source',
      name: 'long-source.md',
      kind: 'markdown',
      mimeType: 'text/markdown;charset=utf-8',
      text: `${Array.from({ length: 400 }, (_, i) => `Line ${i + 1} of a fictional note.`).join('\n\n')}\n\nFinal marker phrase.\n\n${'A long unwrapped source line '.repeat(30)}sideways marker.\n`,
      downloadAllowed: true,
    },
  ];
  page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript((supplied) => {
    window.viewerFiles = supplied as typeof window.viewerFiles;
  }, files);
  await page.goto(`${origin}/__file-viewer`, { timeout: 30000 });
  await page.getByRole('dialog', { name: 'long-resume.pdf' }).waitFor({ timeout: 30000 });
}, 90000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
  if (cache) await rm(cache, { recursive: true, force: true });
});

const dialog = () => page.getByRole('dialog');
const pageField = () => dialog().getByRole('textbox', { name: 'Page number' });
const pageTop = (number: number) =>
  dialog()
    .locator(`[data-page="${number}"]`)
    .evaluate((element) => {
      const body = element.closest('.file-view-body')!;
      return element.getBoundingClientRect().top - body.getBoundingClientRect().top;
    });

test('starts on the document, so keys scroll the file instead of pressing a toolbar button', async () => {
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.getAttribute('aria-label')))
    .toBe('long-resume.pdf contents');
});

test('navigates a long PDF from the page pill and tracks the page most on screen', async () => {
  await dialog().locator('[data-page="4"] canvas').waitFor({ state: 'attached' });
  const pages = await dialog().locator('.file-pdf-page').count();
  expect(pages).toBeGreaterThan(3);
  expect(await dialog().locator('.file-page-pill').innerText()).toContain(`of ${pages}`);
  expect(await pageField().inputValue()).toBe('1');
  await dialog().getByRole('button', { name: 'Next page', exact: true }).click();
  await expect.poll(() => pageField().inputValue()).toBe('2');
  await expect.poll(() => pageTop(2)).toBeLessThan(80);
  await pageField().fill('3');
  await pageField().press('Enter');
  await expect.poll(() => pageField().inputValue()).toBe('3');
  await expect.poll(() => pageTop(3)).toBeLessThan(80);
  // The last page clears the floating pill when scrolled to the end.
  await dialog()
    .locator('.file-view-body')
    .evaluate((body) => body.scrollTo({ top: body.scrollHeight }));
  const clearance = await dialog().evaluate((element) => {
    const last = [...element.querySelectorAll('.file-pdf-page')].at(-1)!.getBoundingClientRect();
    return element.querySelector('.file-page-pill')!.getBoundingClientRect().top - last.bottom;
  });
  expect(clearance).toBeGreaterThan(0);
  await expect.poll(() => pageField().inputValue()).toBe(String(pages));
});

/** The page under the middle of the view and how far down it the middle falls. */
const readingPoint = () =>
  dialog()
    .locator('.file-view-body')
    .evaluate((body) => {
      const box = body.getBoundingClientRect();
      const y = box.top + box.height / 2;
      const sheet = document
        .elementFromPoint(box.left + box.width / 2, y)!
        .closest<HTMLElement>('[data-page]')!;
      const rect = sheet.getBoundingClientRect();
      return { page: sheet.dataset.page, fraction: (y - rect.top) / rect.height };
    });
/** Where the active Find match sits in the visible document, in pixels from its top. */
const matchOffset = () =>
  page.evaluate(() => {
    const range = [...CSS.highlights.get('file-active-match')!][0] as Range;
    const box = document.querySelector('.file-view-body')!.getBoundingClientRect();
    const rect = range.getBoundingClientRect();
    return { top: rect.top - box.top, visible: rect.top >= box.top && rect.bottom <= box.bottom };
  });

test('keeps the reader on the same spot of the same page through zoom and fit changes', async () => {
  await dialog()
    .locator('.file-view-body')
    .evaluate((body) => {
      const sheet = body.querySelector<HTMLElement>('[data-page="3"]')!;
      body.scrollTop = sheet.offsetTop + sheet.offsetHeight * 0.6 - body.clientHeight / 2;
    });
  const before = await readingPoint();
  expect(before.page).toBe('3');
  for (const step of ['Zoom in', 'Zoom in', 'Fit page'] as const) {
    if (step === 'Fit page') {
      await dialog()
        .getByRole('button', { name: /^Zoom, / })
        .click();
      await page.getByRole('menuitemradio', { name: 'Fit page', exact: true }).click();
    } else await dialog().getByRole('button', { name: step, exact: true }).click();
    await page.waitForTimeout(400);
    const after = await readingPoint();
    expect(after.page, step).toBe('3');
    expect(Math.abs(after.fraction - before.fraction), step).toBeLessThan(0.03);
  }
  await page.keyboard.press('ControlOrMeta+0');
  await expect
    .poll(() =>
      dialog()
        .getByRole('button', { name: /^Zoom, / })
        .textContent(),
    )
    .toBe('100%');
});

test('keeps the chosen match in place through zoom and when Find reopens', async () => {
  await page.keyboard.press('ControlOrMeta+f');
  await dialog().getByRole('textbox', { name: 'Find in document' }).fill('booking');
  const count = () => dialog().locator('.file-findbar output').textContent();
  await expect.poll(count).toMatch(/^1 of \d+$/);
  for (let step = 0; step < 40; step++)
    await dialog().getByRole('button', { name: 'Next match', exact: true }).click();
  const total = (await count())!.split(' of ')[1];
  await expect.poll(count).toBe(`41 of ${total}`);
  const before = await matchOffset();
  expect(before.visible).toBe(true);
  await dialog().getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.waitForTimeout(1500);
  expect(await count()).toBe(`41 of ${total}`);
  const after = await matchOffset();
  expect(after.visible).toBe(true);
  expect(Math.abs(after.top - before.top)).toBeLessThan(24);
  // Closing and reopening Find on the same search keeps the match and the scroll position.
  const body = dialog().locator('.file-view-body');
  const scrolled = await body.evaluate((element) => element.scrollTop);
  await page.keyboard.press('Escape');
  await expect.poll(() => dialog().locator('.file-findbar').count()).toBe(0);
  await page.keyboard.press('ControlOrMeta+f');
  await expect.poll(count).toBe(`41 of ${total}`);
  expect(await body.evaluate((element) => element.scrollTop)).toBe(scrolled);
  await dialog().getByRole('button', { name: 'Zoom out', exact: true }).click();
  await page.keyboard.press('Escape');
});

test('marks the current page among thumbnails and keeps them beside the pages', async () => {
  await dialog().getByRole('button', { name: 'More file controls', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Show page thumbnails' }).click();
  const thumbnails = dialog().getByRole('navigation', { name: 'Page thumbnails' });
  await thumbnails.waitFor();
  const current = await pageField().inputValue();
  await expect
    .poll(() => thumbnails.locator('[aria-current="true"]').getAttribute('aria-label'))
    .toBe(`Go to page ${current}`);
  await thumbnails.getByRole('button', { name: 'Go to page 1', exact: true }).click();
  await expect.poll(() => pageField().inputValue()).toBe('1');
});

test('drops a half-typed page number on Escape before closing Find or the viewer', async () => {
  const current = await pageField().inputValue();
  await pageField().fill('9');
  await page.keyboard.press('Escape');
  await expect.poll(() => pageField().inputValue()).toBe(current);
  expect(await dialog().isVisible()).toBe(true);
  // With Find open too, the draft goes first and is never committed by the field losing focus.
  await page.keyboard.press('ControlOrMeta+f');
  await dialog().locator('.file-findbar').waitFor();
  await pageField().fill('3');
  await page.keyboard.press('Escape');
  await expect.poll(() => pageField().inputValue()).toBe(current);
  expect(await dialog().locator('.file-findbar').count()).toBe(1);
  await dialog().getByRole('textbox', { name: 'Find in document' }).focus();
  await page.keyboard.press('Escape');
  await expect.poll(() => dialog().locator('.file-findbar').count()).toBe(0);
  expect(await pageField().inputValue()).toBe(current);
});

test('fits a landscape page whole and a one-page PDF shows no page pill', async () => {
  await dialog().getByRole('button', { name: 'Next attachment', exact: true }).click();
  const wide = page.getByRole('dialog', { name: 'portfolio-sheet.pdf' });
  await wide.locator('.file-pdf-page canvas').waitFor();
  expect(await wide.locator('.file-page-pill').count()).toBe(0);
  const fits = await wide.evaluate((element) => {
    const body = element.querySelector('.file-view-body')!;
    const sheet = element.querySelector('.file-pdf-page')!.getBoundingClientRect();
    return sheet.height <= body.clientHeight && sheet.width <= body.clientWidth;
  });
  expect(fits).toBe(true);
});

test('fits each page of a mixed-orientation PDF by its own size', async () => {
  await dialog().getByRole('button', { name: 'Next attachment', exact: true }).click();
  const mixed = page.getByRole('dialog', { name: 'mixed-pages.pdf' });
  await mixed.locator('[data-page="2"] canvas').waitFor();
  await expect
    .poll(() =>
      mixed.evaluate((element) => {
        const body = element.querySelector('.file-view-body')!;
        const sheets = [...element.querySelectorAll('.file-pdf-page')].map((sheet) =>
          sheet.getBoundingClientRect(),
        );
        return sheets.length === 2 && sheets.every((sheet) => sheet.width <= body.clientWidth);
      }),
    )
    .toBe(true);
  const [portrait, landscape] = await mixed
    .locator('.file-pdf-page')
    .evaluateAll((sheets) => sheets.map((sheet) => sheet.clientWidth / sheet.clientHeight));
  expect(portrait).toBeLessThan(1);
  expect(landscape).toBeGreaterThan(1);
  // The zoom menu shows the scale of the page most on screen.
  const zoom = () => mixed.getByRole('button', { name: /^Zoom, / }).textContent();
  const first = await zoom();
  await mixed
    .locator('.file-view-body')
    .evaluate((body) => body.scrollTo({ top: body.scrollHeight }));
  await expect
    .poll(() => mixed.getByRole('textbox', { name: 'Page number' }).inputValue())
    .toBe('2');
  await expect.poll(zoom).not.toBe(first);
  // In Fit page the landscape page is far wider: with less of its height but more of its area on
  // screen than the portrait page, it is the current page.
  await mixed.getByRole('button', { name: /^Zoom, / }).click();
  await page.getByRole('menuitemradio', { name: 'Fit page', exact: true }).click();
  const shown = await mixed.locator('.file-view-body').evaluate(async (body) => {
    const [portrait, landscape] = [...body.querySelectorAll<HTMLElement>('.file-pdf-page')];
    const box = body.getBoundingClientRect();
    const top = portrait!.getBoundingClientRect().top - box.top + body.scrollTop;
    body.scrollTop = top + portrait!.offsetHeight - body.clientHeight * 0.52;
    await new Promise((resolve) => setTimeout(resolve, 400));
    const visible = (sheet: HTMLElement) => {
      const rect = sheet.getBoundingClientRect();
      return {
        height: Math.max(0, Math.min(rect.bottom, box.bottom) - Math.max(rect.top, box.top)),
        width: rect.width,
      };
    };
    return [visible(portrait!), visible(landscape!)];
  });
  expect(shown[0]!.height).toBeGreaterThan(shown[1]!.height);
  expect(shown[1]!.height * shown[1]!.width).toBeGreaterThan(shown[0]!.height * shown[0]!.width);
  await expect
    .poll(() => mixed.getByRole('textbox', { name: 'Page number' }).inputValue())
    .toBe('2');
  expect(errors).toEqual([]);
});

test('keeps locked Markdown free of table downloads and scales tables and code with text size', async () => {
  await dialog().getByRole('button', { name: 'Next attachment', exact: true }).click();
  const notes = page.getByRole('dialog', { name: 'notes.md' });
  await notes.locator('table').waitFor();
  // Download is locked for this packet file, so nothing inside the document may offer one.
  expect(await notes.getByRole('button', { name: /Download|fullscreen/i }).count()).toBe(1);
  expect(await notes.getByRole('button', { name: 'Download notes.md' }).isDisabled()).toBe(true);
  const sizes = () =>
    notes.evaluate((element) =>
      ['.markdown-content h1', '.markdown-content td', "[data-slot='code-block-code']"].map(
        (selector) => parseFloat(getComputedStyle(element.querySelector(selector)!).fontSize),
      ),
    );
  const [heading, cell, code] = await sizes();
  await notes.getByRole('button', { name: /^Zoom, / }).click();
  await page.getByRole('menuitemradio', { name: '200%' }).click();
  await expect.poll(sizes).toEqual([heading! * 2, cell! * 2, code! * 2]);
  expect(errors).toEqual([]);
});

test('finds whole words at paragraph edges and never across paragraphs', async () => {
  const notes = page.getByRole('dialog', { name: 'notes.md' });
  await page.keyboard.press('ControlOrMeta+f');
  const field = notes.getByRole('textbox', { name: 'Find in document' });
  const count = () => notes.locator('.file-findbar output').textContent();
  await notes.getByRole('button', { name: 'Whole word', exact: true }).click();
  await field.fill('React');
  await expect.poll(count).toBe('1 of 2');
  await field.fill('ReactEngineer');
  await expect.poll(count).toBe('No matches');
  await notes.getByRole('button', { name: 'Whole word', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect.poll(() => notes.locator('.file-findbar').count()).toBe(0);
});

test('scrolls a zoomed image from the keyboard on the focused document', async () => {
  await dialog().getByRole('button', { name: 'Next attachment', exact: true }).click();
  const image = page.getByRole('dialog', { name: 'captured-page.png' });
  await image.locator('img').waitFor();
  await image.getByRole('button', { name: /^Zoom, / }).click();
  await page.getByRole('menuitemradio', { name: '300%' }).click();
  const viewport = image.locator('.file-image-viewport');
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollHeight > element.clientHeight))
    .toBe(true);
  await image.locator('.file-view-body').focus();
  const position = () => viewport.evaluate((element) => [element.scrollTop, element.scrollLeft]);
  const [top, left] = await position();
  await page.keyboard.press('PageDown');
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await position())[0]).toBeGreaterThan(top!);
  expect((await position())[1]).toBeGreaterThan(left!);
  // The pan is the image's own: leaving and coming back finds it where the reader left it.
  const panned = await position();
  await image.getByRole('button', { name: 'Previous attachment', exact: true }).click();
  await page.getByRole('dialog', { name: 'notes.md' }).waitFor();
  await page.getByRole('button', { name: 'Next attachment', exact: true }).click();
  await image.locator('img').waitFor();
  await expect.poll(position).toEqual(panned);
  // Turning the image keeps the same point of the picture under the middle of the view.
  const centre = (rotation: number) =>
    image.evaluate((element, rotation) => {
      const view = element.querySelector('.file-image-viewport')!.getBoundingClientRect();
      const picture = element.querySelector('img')!.getBoundingClientRect();
      const across = (view.left + view.width / 2 - picture.left) / picture.width;
      const down = (view.top + view.height / 2 - picture.top) / picture.height;
      return rotation === 90 ? [down, 1 - across] : [across, down];
    }, rotation);
  const [beforeAcross, beforeDown] = await centre(0);
  await image.getByRole('button', { name: 'More file controls', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Rotate view' }).click();
  await page.waitForTimeout(400);
  const [afterAcross, afterDown] = await centre(90);
  expect(Math.abs(afterAcross! - beforeAcross!)).toBeLessThan(0.03);
  expect(Math.abs(afterDown! - beforeDown!)).toBeLessThan(0.03);
  expect(errors).toEqual([]);
});

test('names layout-note errors in words, not only colour', async () => {
  await dialog().getByRole('button', { name: 'Previous attachment', exact: true }).click();
  for (let step = 0; step < 6; step++) {
    const back = dialog().getByRole('button', { name: 'Previous attachment', exact: true });
    if (await back.isDisabled()) break;
    await back.click();
  }
  const long = page.getByRole('dialog', { name: 'long-resume.pdf' });
  const trigger = long.locator('.file-layout-notes [data-slot="accordion-trigger"]');
  expect(await trigger.innerText()).toBe('2 layout notes · 1 error');
  expect(
    await trigger.evaluate((element) => element.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(32);
  await trigger.click();
  const items = await long.locator('.file-layout-notes-content li').allTextContents();
  expect(items).toEqual([
    'Warning: Page 2Large gap before Role 4.',
    'Error: Expected heading not found.',
  ]);
  expect(
    await long
      .getByRole('navigation', { name: 'Attachments' })
      .getByRole('button', { name: /long-resume\.pdf/ })
      .textContent(),
  ).toContain('2 layout notes · 1 error');
  expect(errors).toEqual([]);
});

test('zooms the file, not the app, on Ctrl+wheel or a trackpad pinch', async () => {
  const zoom = () =>
    dialog()
      .getByRole('button', { name: /^Zoom, / })
      .textContent();
  const before = Number((await zoom())!.slice(0, -1));
  const box = (await dialog().locator('.file-view-body').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.evaluate(() => {
    (window as unknown as { wheels: boolean[] }).wheels = [];
    addEventListener('wheel', (event) => {
      if (event.ctrlKey)
        (window as unknown as { wheels: boolean[] }).wheels.push(event.defaultPrevented);
    });
  });
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -120);
  // Over the toolbar too: no Ctrl+wheel in the viewer may reach the browser's page zoom.
  const bar = (await dialog().locator('.file-toolbar').boundingBox())!;
  await page.mouse.move(bar.x + bar.width / 2, bar.y + bar.height / 2);
  await page.mouse.wheel(0, -120);
  await page.keyboard.up('Control');
  await expect.poll(async () => Number((await zoom())!.slice(0, -1))).toBeGreaterThan(before);
  expect(await page.evaluate(() => (window as unknown as { wheels: boolean[] }).wheels)).toEqual([
    true,
    true,
  ]);
  await page.keyboard.press('ControlOrMeta+0');
});

test('reports a file that cannot be shown and keeps the other files reachable', async () => {
  const broken = page.getByRole('dialog', { name: 'broken.pdf' });
  for (let step = 0; step < 8 && !(await broken.isVisible()); step++)
    await dialog().getByRole('button', { name: 'Next attachment', exact: true }).click();
  await broken
    .getByRole('alert')
    .getByText('This PDF couldn’t be opened. The file may be damaged.')
    .waitFor();
  expect(await broken.getByText('PDF preview unavailable.').count()).toBe(1);
  expect(
    await broken.getByRole('button', { name: 'Previous attachment', exact: true }).isEnabled(),
  ).toBe(true);
});

test('shows a quiet fallback for an image that cannot be shown', async () => {
  await dialog().getByRole('button', { name: 'Next attachment', exact: true }).click();
  const broken = page.getByRole('dialog', { name: 'broken-capture.png' });
  await broken
    .getByRole('alert')
    .getByText('This image couldn’t be opened. The file may be damaged.')
    .waitFor();
  expect(await broken.getByText('Image preview unavailable.').isVisible()).toBe(true);
  expect(await broken.locator('img').isVisible()).toBe(false);
});

test('reports a PDF page that cannot be drawn to the notice line', async () => {
  // Make every canvas refuse a drawing context, then reopen a PDF so its pages render again.
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    (window as unknown as { restoreCanvas: () => void }).restoreCanvas = () => {
      HTMLCanvasElement.prototype.getContext = original;
    };
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  for (const name of ['broken.pdf', 'captured-page.png', 'notes.md', 'mixed-pages.pdf']) {
    await dialog().getByRole('button', { name: 'Previous attachment', exact: true }).click();
    await page.getByRole('dialog', { name }).waitFor();
  }
  const mixed = page.getByRole('dialog', { name: 'mixed-pages.pdf' });
  await mixed
    .getByRole('alert')
    .getByText(/Page \d couldn’t be drawn/)
    .waitFor();
  expect(await mixed.locator('.file-page-error').count()).toBeGreaterThan(0);
  await page.evaluate(() => (window as unknown as { restoreCanvas: () => void }).restoreCanvas());
});

test('ends a search run at block exits as well as entries', async () => {
  const result = await page.evaluate(async () => {
    // Loaded from the Vite fixture server at runtime, outside Vitest's own module transform.
    const load = new Function('path', 'return import(path)') as (
      path: string,
    ) => Promise<typeof import('../src/FileViewer/hooks/useDocumentFind.ts')>;
    const { findTextRanges } = await load('/src/FileViewer/hooks/useDocumentFind.ts');
    const root = document.createElement('div');
    root.innerHTML = '<div>React</div>Engineer<p>Built <b>React</b></p><p>team</p>';
    document.body.append(root);
    const found = {
      joined: findTextRanges(root, 'ReactEngineer', false, false).length,
      crossing: findTextRanges(root, 'Reactteam', false, false).length,
      whole: findTextRanges(root, 'React', false, true).length,
    };
    root.remove();
    return found;
  });
  expect(result).toEqual({ joined: 0, crossing: 0, whole: 2 });
});

test('reveals a distant match in a long Source file', async () => {
  const long = page.getByRole('dialog', { name: 'long-source.md' });
  for (let step = 0; step < 10 && !(await long.isVisible()); step++)
    await dialog().getByRole('button', { name: 'Next attachment', exact: true }).click();
  await long.getByRole('button', { name: 'Source', exact: true }).click();
  await long.locator('pre').waitFor();
  await long.locator('.file-view-body').focus();
  await page.keyboard.press('ControlOrMeta+f');
  await long.getByRole('textbox', { name: 'Find in document' }).fill('Final marker phrase');
  await expect.poll(() => long.locator('.file-findbar output').textContent()).toBe('1 of 1');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const range = [...CSS.highlights.get('file-active-match')!][0] as Range;
        const box = document.querySelector('.file-view-body')!.getBoundingClientRect();
        const rect = range.getBoundingClientRect();
        return rect.top >= box.top && rect.bottom <= box.bottom;
      }),
    )
    .toBe(true);
});

test('reveals a match far along an unwrapped Source line', async () => {
  const long = page.getByRole('dialog', { name: 'long-source.md' });
  await page.keyboard.press('Escape');
  await expect.poll(() => long.locator('.file-findbar').count()).toBe(0);
  await long.getByRole('button', { name: 'More file controls', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Turn off line wrap' }).click();
  await long.locator('.file-view-body').focus();
  await page.keyboard.press('ControlOrMeta+f');
  await long.getByRole('textbox', { name: 'Find in document' }).fill('sideways marker');
  await expect.poll(() => long.locator('.file-findbar output').textContent()).toBe('1 of 1');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const range = [...CSS.highlights.get('file-active-match')!][0] as Range;
        const lane = document.querySelector('.file-text-document')!.getBoundingClientRect();
        const rect = range.getBoundingClientRect();
        return rect.left >= lane.left && rect.right <= lane.right;
      }),
    )
    .toBe(true);
});
