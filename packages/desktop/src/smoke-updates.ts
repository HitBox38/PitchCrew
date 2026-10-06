/** Real renderer checks using only the fixture daemon's injected release responses. */
export const smokeUpdates = `(async () => {
  const notice = await waitFor(() => !!document.querySelector('[aria-label="Dismiss update notice"]'));
  document.querySelector('a[href="/settings?section=general"]')?.click();
  const settings = await waitFor(() => !!document.querySelector('#updates-heading'));
  const section = document.querySelector('#updates-heading')?.closest('section');
  const version = section?.textContent.includes('Version 0.1.0') && section?.textContent.includes('Build aaaaaaaaaaaa');
  const release = section?.querySelector('a[aria-label="View release and download"]');
  const link = release?.getAttribute('href') === 'https://github.com/HitBox38/PitchCrew/releases/tag/build-' + 'b'.repeat(40) && release?.getAttribute('target') === '_blank';
  const preference = section?.querySelector('[role="checkbox"]');
  const enabled = preference?.getAttribute('aria-checked') === 'true';
  const bounds = preference?.getBoundingClientRect();
  const compactControl = bounds && bounds.width > 0 && bounds.width <= 24 && bounds.height <= 24;
  preference?.click();
  const disabled = await waitFor(() => localStorage.getItem('pitchcrew-automatic-updates-v1') === 'false');
  preference?.click();
  const restored = await waitFor(() => localStorage.getItem('pitchcrew-automatic-updates-v1') === 'true');
  const button = [...section?.querySelectorAll('button') ?? []].find((button) => button.textContent.includes('Check for updates'));
  button?.click();
  const manual = await waitFor(() => section?.querySelector('output')?.textContent.includes('A newer Pitchcrew build is available.') && !button?.disabled);
  document.querySelector('[aria-label="Dismiss update notice"]')?.click();
  const dismissed = await waitFor(() => !document.querySelector('[aria-label="Dismiss update notice"]'));
  const stillAvailable = !!section?.querySelector('a[aria-label="View release and download"]');
  section?.scrollIntoView({ block: 'center' });
  return notice && settings && version && link && enabled && compactControl && disabled && restored && manual && dismissed && stillAvailable;
})()`;
