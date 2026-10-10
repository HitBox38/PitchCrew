/** Exercise the unified context menu, job search and persistent job chips in the fixture UI. */
export const smokeComposerContext = `(async () => {
  const request = async (path, method, body) => {
    const response = await fetch('/api' + path, {
      method, headers: { 'x-pitchcrew-client': 'ui', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error('Composer context fixture request failed: ' + path);
    return response.json();
  };
  const menuItem = (text) => [...document.querySelectorAll('[role="menuitem"]')].find((item) => item.textContent.includes(text));
  document.querySelector('button[aria-label="Add context"]')?.click();
  if (!await waitFor(() => !!menuItem('Add files'))) throw new Error('Unified attachment menu did not open.');
  const input = document.querySelector('input[aria-label="Choose chat attachments"]');
  const originalClick = input.click;
  let filePickerOpened = false;
  input.click = () => { filePickerOpened = true; };
  try { menuItem('Add files').click(); } finally { input.click = originalClick; }
  if (!await waitFor(() => !menuItem('Add files'))) throw new Error('Attachment menu did not close.');
  document.querySelector('button[aria-label="Add context"]')?.click();
  const locked = await waitFor(() => menuItem('Attach a job')?.getAttribute('aria-disabled') === 'true');
  document.querySelector('button[aria-label="Add context"]')?.click();
  await waitFor(() => !menuItem('Attach a job'));
  const job = await request('/cards', 'POST', { company: 'Fictional Composer Company', title: 'Fictional Engineer' });
  const conversation = await request('/conversations', 'POST', { title: 'Fictional composer context', participants: ['scout'], leadId: 'scout' });
  if (!await waitFor(() => !!document.querySelector('a[href="/chat/' + conversation.id + '"]'))) throw new Error('Composer fixture conversation did not appear.');
  document.querySelector('a[href="/chat/' + conversation.id + '"]').click();
  await waitFor(() => location.pathname === '/chat/' + conversation.id && !!document.querySelector('button[aria-label="Add context"]'));
  const attachJob = async () => {
    document.querySelector('button[aria-label="Add context"]').click();
    await waitFor(() => !!menuItem('Attach a job'));
    menuItem('Attach a job').click();
    if (!await waitFor(() => !!document.querySelector('input[aria-label="Search conversation jobs"]'))) throw new Error('Conversation job search did not open.');
    const search = document.querySelector('input[aria-label="Search conversation jobs"]');
    if (!await waitFor(() => document.activeElement === search)) throw new Error('Job search did not receive keyboard focus.');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(search, 'Fictional Composer Company');
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => document.querySelectorAll('.chat-job-picker [cmdk-item]').length === 1);
    document.querySelector('.chat-job-picker [cmdk-item]').click();
    return waitFor(() => !!document.querySelector('.chat-context-job') && !document.querySelector('.chat-job-picker') && document.activeElement === document.querySelector('button[aria-label="Add context"]'));
  };
  const selected = await attachJob();
  document.querySelector('button[aria-label="Remove conversation job"]')?.click();
  const removed = await waitFor(() => !document.querySelector('.chat-context-job'));
  const reattached = await attachJob();
  const snapshot = await fetch('/api/snapshot', { headers: { 'x-pitchcrew-client': 'ui' } }).then((response) => response.json());
  const persisted = snapshot.conversations.find((item) => item.id === conversation.id)?.cardId === job.id;
  document.querySelector('nav[aria-label="Conversations"] a[href="/chat/scout"]').click();
  await waitFor(() => location.pathname === '/chat/scout' && document.querySelector('.chat-heading h2')?.textContent === 'Scout chat' && !document.querySelector('.chat-context-job'));
  const checks = { filePickerOpened, locked, selected, removed, reattached, persisted };
  if (!Object.values(checks).every(Boolean)) throw new Error('Composer context checks: ' + JSON.stringify(checks));
  return true;
})()`;
