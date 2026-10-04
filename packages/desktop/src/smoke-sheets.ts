/** Checks real portaled sheets against the desktop's usable viewport. */
export const smokeSheetBounds = `(async () => {
  await new Promise((resolve) => setTimeout(resolve, 350));
  const sheet = document.querySelector('[data-sheet-content]');
  const overlay = document.querySelector('[data-slot="sheet-overlay"]');
  const titlebar = document.querySelector('.desktop-titlebar');
  if (!sheet || !overlay || !titlebar) return false;
  const bounds = sheet.getBoundingClientRect();
  const backdrop = overlay.getBoundingClientRect();
  const chromeBottom = titlebar.getBoundingClientRect().bottom;
  const footer = sheet.querySelector('.role-settings-footer');
  const footerBounds = footer?.getBoundingClientRect();
  return bounds.top === chromeBottom && bounds.bottom === innerHeight &&
    backdrop.top === chromeBottom && backdrop.bottom === innerHeight &&
    (!footerBounds || (footerBounds.top >= bounds.top && footerBounds.bottom <= bounds.bottom));
})()`;

/** Leaves an untouched creation sheet open for screenshots; no settings are saved. */
export const smokeOpenCreation = `(async () => {
  const waitFor = async (test) => {
    for (let attempt = 0; attempt < 40; attempt++) {
      if (test()) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return false;
  };
  document.querySelector('a[href="/crew"]')?.click();
  await waitFor(() => !!document.querySelector('.crew-card'));
  [...document.querySelectorAll('button')].find((button) => button.textContent === 'Create agent')?.click();
  await waitFor(() => !!document.querySelector('.creation-panel'));
  return await ${smokeSheetBounds};
})()`;

export const smokeCloseCreation = `(async () => {
  document.querySelector('[aria-label="Close agent creation"]')?.click();
  for (let attempt = 0; attempt < 40; attempt++) {
    if (!document.querySelector('[data-sheet-content]')) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
})()`;
