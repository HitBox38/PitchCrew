import type { Page } from 'playwright';

const moreTrigger = (page: Page) => page.getByRole('button', { name: /^More(?: pages|, )/ });

/** Queue, Skills, Routines, Insights and Activity live behind the sidebar's More menu. */
export const openMorePage = async (page: Page, name: string | RegExp) => {
  await moreTrigger(page).click();
  await page
    .getByRole('menuitem', { name: typeof name === 'string' ? new RegExp(`^${name}`) : name })
    .click();
};

/**
 * Skills updates are counted on the Skills row of the More menu. Opens the menu, reads the count
 * (0 when the row has none) and closes it again.
 */
export const skillsUpdateCount = async (page: Page) => {
  await moreTrigger(page).click();
  const item = page.getByRole('menuitem', { name: /^Skills/ });
  await item.waitFor();
  const count = Number((await item.textContent())?.replace(/\D/g, '') || 0);
  await page.keyboard.press('Escape');
  await item.waitFor({ state: 'hidden' });
  return count;
};
