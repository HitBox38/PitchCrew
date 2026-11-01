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
  const footer = sheet.querySelector('.agent-panel-footer');
  const footerBounds = footer?.getBoundingClientRect();
  return bounds.top === chromeBottom && bounds.bottom === innerHeight &&
    backdrop.top === chromeBottom && backdrop.bottom === innerHeight &&
    (!footerBounds || (footerBounds.top >= bounds.top && footerBounds.bottom <= bounds.bottom));
})()`;

/** Checks a real portaled dialog stays inside the desktop's usable viewport below the title bar. */
export const smokeDialogBounds = `(async () => {
  await new Promise((resolve) => setTimeout(resolve, 350));
  const dialog = document.querySelector('[data-slot="dialog-content"]');
  const overlay = document.querySelector('[data-slot="dialog-overlay"]');
  const titlebar = document.querySelector('.desktop-titlebar');
  if (!dialog || !overlay || !titlebar) return false;
  const bounds = dialog.getBoundingClientRect();
  const chromeBottom = titlebar.getBoundingClientRect().bottom;
  return bounds.top >= chromeBottom && bounds.bottom <= innerHeight && bounds.left >= 0 && bounds.right <= innerWidth;
})()`;

/** Leaves an untouched agent creation dialog open for screenshots; no settings are saved. */
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
  const create = () => [...document.querySelectorAll('.workspace-title-primary button, .workspace-title-actions button')].find((button) => button.textContent.trim() === 'New agent');
  await waitFor(() => !!create());
  create()?.click();
  await waitFor(() => !!document.querySelector('.agent-wizard'));
  return await ${smokeDialogBounds};
})()`;

export const smokeCloseCreation = `(async () => {
  document.querySelector('[aria-label="Close agent creation"]')?.click();
  for (let attempt = 0; attempt < 40; attempt++) {
    if (!document.querySelector('.agent-wizard')) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
})()`;
