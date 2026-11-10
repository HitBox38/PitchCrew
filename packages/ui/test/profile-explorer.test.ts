import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { cleanup, setup } from './helpers/daemon.ts';

let host: Awaited<ReturnType<typeof setup>>;
let browser: Browser;
let page: Page;
const name = 'Experience-Engineering-Leadership-and-Project-Highlights-0123456789abcdef.md';
// The explorer and tabs show note titles without the shared .md extension.
const title = name.replace(/\.md$/, '').replace(/-/g, ' ');
const folder = 'Background-and-professional-project-documentation';
const quote = 'Led the fictional migration with a verified reduction in processing time.';
const errors: string[] = [];

beforeAll(async () => {
  host = await setup(14620);
  await host.daemon.service.saveProfile(
    name,
    `# Fictional career background\n\n${'A documented project with supporting evidence.\n\n'.repeat(80)}${quote}`,
  );
  await host.daemon.service.saveProfile('Next-note.md', '# Another fictional note');
  const card = host.daemon.service.createCard({ company: 'Fictional Studio', title: 'Engineer' });
  host.daemon.service.board.updateCard(
    card.id,
    {
      packet: {
        resume: quote,
        coverLetter: '',
        formAnswers: '',
        note: '',
        claims: [{ source: name, quote, claim: quote }],
      },
    },
    'writer',
    'Fixture packet citing a profile note',
  );
  await host.request('/profile/organization', 'POST', { action: 'create', path: folder });
  await host.request('/profile/organization', 'POST', { action: 'move', name, folder });
  browser = await chromium.launch({ headless: true });
}, 60000);

afterAll(async () => {
  await browser?.close();
  await cleanup();
});

test.each([1440, 1000, 390])(
  'long explorer labels stay inside their rows at %ipx',
  async (width) => {
    page = await browser.newPage({ viewport: { width, height: 800 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(10000);
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(`${host.daemon.url}/profile`, { waitUntil: 'domcontentloaded' });
      await page.locator('.profile-workspace').waitFor();
      const later = page.getByRole('button', { name: 'Set up later', exact: true });
      if (await later.isVisible()) await later.click();
      const show = page.getByRole('button', { name: 'Show notes explorer', exact: true });
      if (await show.isVisible()) await show.click();
      const note = page.getByRole('treeitem', { name: title, exact: true });
      await note.waitFor();
      await page.evaluate(() => document.fonts.ready);
      for (const label of [folder, title]) {
        const item = page.getByRole('treeitem', { name: label, exact: true });
        const layout = await item.evaluate((element) => {
          const text = element.querySelector('span')!;
          const bounds = element.getBoundingClientRect();
          const labelBounds = text.getBoundingClientRect();
          const move = element.parentElement!.querySelector('.profile-row-menu');
          return {
            rowHeight: bounds.height,
            labelHeight: labelBounds.height,
            lineHeight: parseFloat(getComputedStyle(text).lineHeight),
            top: labelBounds.top - bounds.top,
            bottom: bounds.bottom - labelBounds.bottom,
            right: (move?.getBoundingClientRect().left ?? bounds.right) - labelBounds.right,
            menuOverflow: (move?.getBoundingClientRect().bottom ?? bounds.bottom) - bounds.bottom,
            truncated: text.scrollWidth > text.clientWidth,
          };
        });
        expect(layout.labelHeight).toBeLessThanOrEqual(layout.lineHeight);
        // Phones get the shared 44px touch floor; wider screens keep compact rows.
        expect(layout.rowHeight).toBeLessThanOrEqual(width > 390 ? 38 : 44);
        expect(layout.top).toBeGreaterThanOrEqual(0);
        expect(layout.bottom).toBeGreaterThanOrEqual(0);
        expect(layout.right).toBeGreaterThanOrEqual(0);
        expect(layout.menuOverflow).toBeLessThanOrEqual(0);
        if (width > 390 || label === title) expect(layout.truncated).toBe(true);
        expect(await item.getAttribute('title')).toBe(label === title ? name : label);
      }
      await note.focus();
      const actions = page.getByRole('button', { name: `Actions for ${title}`, exact: true });
      expect(await actions.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
      await actions.click();
      await page.getByRole('menuitem', { name: 'Move to folder…', exact: true }).waitFor();
      await page.keyboard.press('Escape');
      await note.focus();
      await page.keyboard.press('Enter');
      await page.getByRole('textbox', { name: 'Profile Markdown', exact: true }).waitFor();
      await expect
        .poll(() => page.getByRole('textbox', { name: 'Profile Markdown' }).innerText())
        .toContain('Fictional career background');
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  },
);

const openWorkspace = async (page: Page) => {
  page.setDefaultTimeout(10000);
  await page.goto(`${host.daemon.url}/profile`, { waitUntil: 'domcontentloaded' });
  await page.locator('.profile-workspace').waitFor();
  const later = page.getByRole('button', { name: 'Set up later', exact: true });
  if (await later.isVisible()) await later.click();
};

test('the document fills the available workspace on a wide desktop', async () => {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    reducedMotion: 'reduce',
  });
  try {
    await openWorkspace(page);
    // The editor loads lazily; measure once it is there.
    await page.locator('.profile-body .cm-editor').waitFor();
    const layout = await page.locator('.profile-body').evaluate((element) => {
      const frame = element.getBoundingClientRect();
      const document = element.querySelector('.profile-document')!.getBoundingClientRect();
      const editor = element.querySelector('.cm-editor')!.getBoundingClientRect();
      return {
        rightGap: frame.right - document.right,
        bottomGap: frame.bottom - document.bottom,
        documentWidth: document.width,
        editorWidth: editor.width,
        editorHeight: editor.height,
      };
    });
    expect(Math.abs(layout.rightGap)).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.bottomGap)).toBeLessThanOrEqual(1);
    expect(layout.documentWidth).toBeGreaterThan(1000);
    expect(Math.abs(layout.documentWidth - layout.editorWidth)).toBeLessThanOrEqual(2);
    expect(layout.editorHeight).toBeGreaterThan(600);
  } finally {
    await page.close();
  }
});

test.each([390, 768])('opening another note reveals its active tab at %ipx', async (width) => {
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  try {
    await openWorkspace(page);
    const show = page.getByRole('button', { name: 'Show notes explorer', exact: true });
    if (await show.isVisible()) await show.click();
    await page.getByRole('treeitem', { name: 'Next note', exact: true }).click();
    await expect
      .poll(() =>
        page.locator('.profile-document-tabs').evaluate((lane) => {
          const tab = lane.querySelector('[data-selected="true"]')!.getBoundingClientRect();
          const strip = lane.getBoundingClientRect();
          return tab.left >= strip.left - 1 && tab.right <= strip.right + 1;
        }),
      )
      .toBe(true);
    await expect
      .poll(() => page.getByRole('textbox', { name: 'Profile Markdown' }).innerText())
      .toContain('Another fictional note');
  } finally {
    await page.close();
  }
});

test.each([1000, 1920])('explorer keyboard resizing persists at %ipx', async (width) => {
  const page = await browser.newPage({
    viewport: { width, height: 900 },
    reducedMotion: 'reduce',
  });
  try {
    await openWorkspace(page);
    const show = page.getByRole('button', { name: 'Show notes explorer', exact: true });
    if (await show.isVisible()) await show.click();
    const handle = page.getByRole('separator', { name: 'Resize notes explorer', exact: true });
    const explorer = page.getByRole('complementary', { name: 'Notes explorer', exact: true });
    const actualWidth = () => explorer.evaluate((element) => element.getBoundingClientRect().width);
    const initial = await actualWidth();
    await handle.focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(actualWidth).toBe(initial + 16);
    expect(await handle.getAttribute('aria-valuenow')).toBe(String(initial + 16));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(actualWidth).toBe(initial + 16);
    expect(await handle.getAttribute('aria-valuenow')).toBe(String(initial + 16));
    await handle.focus();
    await page.keyboard.press('Home');
    await expect.poll(actualWidth).toBe(180);
    await page.keyboard.press('End');
    await expect.poll(actualWidth).toBe(420);
  } finally {
    await page.close();
  }
});

test('a touch tablet resize handle leaves the editor controls reachable', async () => {
  const page = await browser.newPage({
    viewport: { width: 1000, height: 900 },
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  try {
    await openWorkspace(page);
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
    // A 1000px window opens the explorer by default.
    await page.getByRole('button', { name: 'Hide notes explorer', exact: true }).waitFor();
    const handle = page.getByRole('separator', { name: 'Resize notes explorer', exact: true });
    const handleBounds = await handle.boundingBox();
    const documentBounds = await page.locator('.profile-document').boundingBox();
    expect(handleBounds).not.toBeNull();
    expect(documentBounds).not.toBeNull();
    expect(handleBounds!.x + handleBounds!.width).toBeLessThanOrEqual(documentBounds!.x + 1);
    const hide = page.getByRole('button', { name: 'Hide notes explorer', exact: true });
    expect(
      await hide.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return element.contains(
          document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2),
        );
      }),
    ).toBe(true);
    await hide.click();
    expect(await page.getByRole('complementary', { name: 'Notes explorer' }).isVisible()).toBe(
      false,
    );
  } finally {
    await page.close();
  }
});

test.each([390, 1000, 1920])(
  'cited lines reveal their source in the editor at %ipx',
  async (width) => {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      reducedMotion: 'reduce',
    });
    try {
      await openWorkspace(page);
      const show = page.getByRole('button', { name: 'Show notes explorer', exact: true });
      if (await show.isVisible()) await show.click();
      await page.getByRole('treeitem', { name: title, exact: true }).click();
      await page.getByRole('button', { name: 'Preview', exact: true }).click();
      await page.getByRole('button', { name: 'Cited in 1 packet', exact: true }).click();
      await page.getByRole('button', { name: quote, exact: true }).click();
      const editor = page.getByRole('textbox', { name: 'Profile Markdown', exact: true });
      // Revealing a quote switches to Write, selects and marks the exact line (⌘K on that
      // selection still opens the command palette) and scrolls it into view.
      await expect
        .poll(() =>
          editor.evaluate((element) => ({
            focused: element.contains(document.activeElement),
            marked: [...element.querySelectorAll('.cm-md-revealed')]
              .map((mark) => mark.textContent)
              .join(''),
            selected: document.getSelection()?.toString(),
            scrolled: element.closest('.cm-scroller')!.scrollTop > 0,
          })),
        )
        .toEqual({ focused: true, marked: quote, selected: quote, scrolled: true });
      await expect.poll(() => page.locator('.profile-cited-popover').isVisible()).toBe(false);
    } finally {
      await page.close();
    }
  },
);

test('a long save error and citations keep Retry reachable on a phone', async () => {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  try {
    await openWorkspace(page);
    const show = page.getByRole('button', { name: 'Show notes explorer', exact: true });
    if (await show.isVisible()) await show.click();
    await page.getByRole('treeitem', { name: title, exact: true }).click();
    await page.route('**/api/profile', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error:
            'The profile folder could not be written. Check the disk and its permissions before trying again.',
        }),
      }),
    );
    const editor = page.getByRole('textbox', { name: 'Profile Markdown', exact: true });
    await editor.click();
    await page.keyboard.type(' Edited draft.');
    // Autosave fails visibly; the draft stays and Retry saves it on request.
    await page.locator('.profile-save-state[data-tone="error"]').waitFor();
    const save = page.getByRole('button', { name: 'Save note', exact: true });
    const bounds = await save.boundingBox();
    expect(await save.textContent()).toContain('Retry');
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
    expect(await save.isEnabled()).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  } finally {
    await page.close();
  }
});
