/** Exercises first-run setup only inside the isolated Electron fixture workspace. */
export const smokeOnboarding = `(async () => {
  const click = (text) => [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === text)?.click();
  const welcome = await waitFor(() => document.querySelector('.onboarding-dialog')?.textContent.includes('Your job search has a crew.'));
  [...document.querySelectorAll('.onboarding-dialog button')].find((button) => button.textContent.trim() === 'Continue')?.click();
  const approval = await waitFor(() => document.querySelector('.onboarding-dialog')?.textContent.includes('You make the final call.'));
  click('Start setup');
  const checklist = await waitFor(() => !document.querySelector('[role="dialog"]') && !!document.querySelector('.onboarding-checklist'));
  click('Set up later');
  const deferred = await waitFor(() => !document.querySelector('.onboarding-checklist'));
  // The sidebar's Getting started row brings the deferred checklist back to Board.
  document.querySelector('button[aria-label^="Getting started,"]')?.click();
  const resumed = await waitFor(() => !!document.querySelector('.onboarding-checklist'));
  click('Set up later');
  const deferredAgain = await waitFor(() => !document.querySelector('.onboarding-checklist'));
  // The introduction itself reopens from the command palette (and Settings > General).
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
  await waitFor(() => [...document.querySelectorAll('.command-palette [role="option"]')].some((item) => item.textContent.includes('Show introduction')));
  [...document.querySelectorAll('.command-palette [role="option"]')].find((item) => item.textContent.includes('Show introduction'))?.click();
  const reopened = resumed && deferredAgain && await waitFor(() => !!document.querySelector('.onboarding-dialog'));
  click('Set up later');
  const closed = await waitFor(() => !document.querySelector('[role="dialog"]'));
  const saved = await fetch('/api/snapshot', { headers: { 'x-pitchcrew-client': 'ui' } }).then((response) => response.json());
  return welcome && approval && checklist && deferred && reopened && closed && saved.onboarding?.status === 'dismissed';
})()`;
