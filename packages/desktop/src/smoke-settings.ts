/** Exercise the visible settings navigation at both desktop and compact widths. */
export const smokeSettingsNavigation = `const openSettingsSection = async (section, label) => {
  if (location.pathname !== '/settings') document.querySelector('.workspace-settings')?.click();
  const navigation = () => document.querySelector('nav[aria-label="Settings"]');
  const tab = () => [...navigation()?.querySelectorAll('[role="tab"]') ?? []].find(item => item.textContent.trim() === label);
  const picker = () => navigation()?.querySelector('[role="combobox"][aria-label="Settings section"]');
  if (!await waitFor(() => location.pathname === '/settings' && (tab() || picker()))) throw new Error('Settings navigation unavailable for ' + label + '.');
  if (tab()) tab().click();
  else {
    picker().click();
    const option = () => [...document.querySelectorAll('[role="option"]')].find(item => item.textContent.trim() === label);
    if (!await waitFor(() => !!option())) throw new Error('Settings section option missing: ' + label + '.');
    option().click();
  }
  if (!await waitFor(() => new URLSearchParams(location.search).get('section') === section)) throw new Error('Settings section did not open: ' + label + '.');
};`;
