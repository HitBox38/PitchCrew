/** Shared renderer check using only the fixture daemon's fake authentication and installer. */
export const smokeRuntimeUpdates = `(async () => {
  document.querySelector('a[href^="/settings"]')?.click();
  if (!await waitFor(() => location.pathname === '/settings')) throw new Error('Runtime settings navigation failed.');
  [...document.querySelectorAll('[role="tab"]')].find(tab => tab.textContent.includes('Runtimes'))?.click();
  if (!await waitFor(() => !!document.querySelector('#automatic-runtime-updates'))) throw new Error('Runtime update preference missing.');
  document.querySelector('#automatic-runtime-updates').click();
  const row = () => document.querySelector('#runtime-claude-code');
  if (!await waitFor(() => row()?.textContent.includes('Update available: 1.1.0'))) throw new Error('Runtime update notice missing.');
  const update = () => [...row()?.querySelectorAll('button') ?? []].find(button => button.textContent.trim() === 'Update');
  if (!await waitFor(() => update() && !update().disabled)) throw new Error('Runtime Update button unavailable.');
  update().click();
  if (!await waitFor(() => row()?.textContent.includes('Updating'))) throw new Error('Runtime progress missing.');
  document.querySelector('a[href="/crew"]')?.click();
  if (!await waitFor(() => location.pathname === '/crew')) throw new Error('Could not navigate during an update.');
  document.querySelector('.notification-bell')?.click();
  const link = () => document.querySelector('.notification-list a[href*="runtime=claude-code"]');
  if (!await waitFor(() => !!link())) throw new Error('Runtime progress notification missing.');
  link().click();
  if (!await waitFor(() => location.pathname === '/settings' && location.search.includes('runtime=claude-code') && row()?.textContent.includes('Runtime updated.'))) throw new Error('Runtime result did not survive navigation.');
  const output = [...row()?.querySelectorAll('button') ?? []].find(button => button.textContent.includes('Installer output'));
  output?.click();
  if (!await waitFor(() => row()?.textContent.includes('Fixture installer completed'))) throw new Error('Installer output missing.');
  const state = await fetch('/api/runtimes/maintenance', { headers: { 'x-pitchcrew-client': 'ui' } }).then(response => response.json());
  const result = state.updates.find(entry => entry.id === 'claude-code');
  if (result.operation.stage !== 'succeeded' || result.installedVersion !== '1.1.0' || !state.automatic) throw new Error('Runtime update verification failed.');
  return true;
})()`;
