/** Check responsive editors, a usable composer and guarded switching from agent defaults. */
export const smokeChatPanels = `(async () => {
  const openOption = async (label) => {
    document.querySelector('button[aria-label="Conversation options"]')?.click();
    if (!await waitFor(() => [...document.querySelectorAll('[role="menuitem"]')].some((item) => item.textContent.includes(label)))) throw new Error('Missing conversation option: ' + label);
    [...document.querySelectorAll('[role="menuitem"]')].find((item) => item.textContent.includes(label))?.click();
  };
  await openOption('Name, participants and job');
  if (!await waitFor(() => !!document.querySelector('.chat-side-panel #conversation-title'))) throw new Error('Conversation settings did not open.');
  const panel = document.querySelector('.chat-side-panel');
  const chat = document.querySelector('.chat-panel');
  // CI desktops can constrain the initial window below the panel's docking breakpoint.
  const positioned = await waitFor(() => {
    const bounds = panel.getBoundingClientRect();
    const workspace = document.querySelector('.chat-workspace').getBoundingClientRect();
    const overlaysChat = getComputedStyle(panel).position === 'absolute';
    const placement = overlaysChat ? bounds.left >= workspace.left - 1 : bounds.left >= chat.getBoundingClientRect().right - 1;
    return placement && Math.abs(bounds.right - workspace.right) <= 1 && bounds.top >= workspace.top - 1 && bounds.bottom <= workspace.bottom + 1 && !document.querySelector('[data-slot="sheet-overlay"], [data-slot="dialog-overlay"]');
  });
  const composer = document.querySelector('.chat-textarea');
  composer.focus();
  const interactive = document.activeElement === composer && !!document.querySelector('.chat-side-panel');
  await openOption('Agent memory');
  const memory = await waitFor(() => !!document.querySelector('.chat-side-panel input[aria-label="Search agent memory"]') && !document.querySelector('#conversation-title') && document.querySelectorAll('.chat-side-panel').length === 1);
  await openOption('Agent defaults');
  if (!await waitFor(() => !!document.querySelector('.chat-side-panel #role-name'))) throw new Error('Agent defaults did not open.');
  const name = document.querySelector('#role-name');
  const original = name.value;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(name, original + ' unsaved');
  name.dispatchEvent(new Event('input', { bubbles: true }));
  await waitFor(() => name.value !== original);
  document.querySelector('.chat-runtime')?.click();
  const guarded = await waitFor(() => [...document.querySelectorAll('[role="dialog"]')].some((dialog) => dialog.textContent.includes('Discard unsaved changes?')));
  [...document.querySelectorAll('button')].find((button) => button.textContent === 'Keep editing')?.click();
  const retained = await waitFor(() => !document.querySelector('.discard-description') && document.querySelector('#role-name')?.value === original + ' unsaved');
  document.querySelector('.chat-runtime')?.click();
  await waitFor(() => !!document.querySelector('.discard-description'));
  [...document.querySelectorAll('button')].find((button) => button.textContent === 'Discard changes')?.click();
  const switched = await waitFor(() => !!document.querySelector('.chat-side-panel #conversation-runtime') && !document.querySelector('#role-name') && document.querySelectorAll('.chat-side-panel').length === 1);
  document.querySelector('.chat-side-panel button[aria-label="Close chat panel"]')?.click();
  const closed = await waitFor(() => !document.querySelector('.chat-side-panel') && document.activeElement === document.querySelector('.chat-runtime'));
  const saved = await fetch('/api/snapshot', { headers: { 'x-pitchcrew-client': 'ui' } }).then((response) => response.json());
  const unchanged = saved.roles.some((role) => role.name === original) && !saved.roles.some((role) => role.name === original + ' unsaved');
  const checks = { positioned, interactive, memory, guarded, retained, switched, closed, unchanged };
  if (!Object.values(checks).every(Boolean)) throw new Error('Chat panel checks: ' + JSON.stringify({ ...checks, viewport: [innerWidth, innerHeight], active: document.activeElement?.outerHTML.slice(0,500), panelRemaining: !!document.querySelector('.chat-side-panel') }));
  return true;
})()`;
