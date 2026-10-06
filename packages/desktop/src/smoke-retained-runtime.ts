/** Verify production can display and reconfigure a retained Demo role without running it. */
export const smokeRetainedRuntime = `(async () => {
  if (snapshot.runtimes.some((runtime) => runtime.id === 'demo')) throw new Error('Demo must be absent in production.');
  document.querySelector('a[href="/chat/writer"]')?.click();
  const chat = await waitFor(() => location.pathname === '/chat/writer' && !!document.querySelector('textarea[aria-label="Message Writer"]'));
  if (!chat) throw new Error('Retained Demo chat failed to render.');
  const unavailable = document.querySelector('textarea[aria-label="Message Writer"]')?.disabled && document.querySelector('.chat-compose')?.textContent.includes('Choose an installed runtime');
  const blocked = await fetch('/api/roles/writer/chat', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-pitchcrew-client': 'ui' },
    body: JSON.stringify({ content: 'Fictional blocked Demo request.' }),
  });
  const before = await fetch('/api/snapshot', { headers: { 'x-pitchcrew-client': 'ui' } }).then((response) => response.json());
  if (blocked.ok || before.runs.length || before.messages.length) throw new Error('Production accepted a Demo chat.');
  document.querySelector('button[aria-label="Configure Writer"]')?.click();
  const settings = await waitFor(() => !!document.querySelector('#writer-runtime'));
  if (!settings) throw new Error('Retained Demo settings failed to render.');
  const demoLabel = document.querySelector('#writer-runtime')?.textContent.includes('Demo (unavailable)');
  document.querySelector('#writer-runtime')?.click();
  await waitFor(() => [...document.querySelectorAll('[role="option"]')].some((item) => item.textContent === 'Claude Code'));
  [...document.querySelectorAll('[role="option"]')].find((item) => item.textContent === 'Claude Code')?.click();
  const selected = await waitFor(() => document.querySelector('#writer-runtime [data-slot="select-value"]')?.textContent === 'Claude Code');
  if (!selected) throw new Error('Could not select a real runtime for retained Demo role.');
  document.querySelector('.role-settings-form')?.requestSubmit();
  const saved = await waitFor(() => !document.querySelector('.role-settings-panel') && !document.querySelector('textarea[aria-label="Message Writer"]')?.disabled);
  const after = await fetch('/api/snapshot', { headers: { 'x-pitchcrew-client': 'ui' } }).then((response) => response.json());
  const restored = after.roles.find((role) => role.id === 'writer');
  const original = snapshot.roles.find((role) => role.id === 'writer');
  return unavailable && demoLabel && selected && saved && restored.runtime === 'claude-code' && restored.instructions === original.instructions && JSON.stringify(restored.capabilities) === JSON.stringify(original.capabilities) && after.runs.length === 0 && after.messages.length === 0;
})()`;
