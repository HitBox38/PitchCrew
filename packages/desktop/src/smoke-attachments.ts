/** Exercises the shared React composer with fixture files in the isolated smoke workspace. */
export const smokeAttachments = `(async () => {
  const selected = () => document.querySelector('ul[aria-label="Files to attach"]');
  const picker = () => document.querySelector('input[aria-label="Choose chat attachments"]');
  const transfer = (name, text = 'Fictional chat attachment.') => {
    const data = new DataTransfer(); data.items.add(new File([text], name, { type: 'text/plain' })); return data;
  };
  const select = (data) => { const input = picker(); input.files = data.files; input.dispatchEvent(new Event('change', { bubbles: true })); };
  select(transfer('unsupported.exe'));
  const validation = await waitFor(() => document.querySelector('.chat-compose [role="alert"]')?.textContent.includes('not supported') && !selected());
  select(transfer('fixture-notes.md'));
  const picked = await waitFor(() => selected()?.textContent.includes('fixture-notes.md') && !document.querySelector('button[aria-label="Send message"]').disabled);
  document.querySelector('.chat-thread .role-avatar.writer')?.closest('button')?.click();
  const isolated = await waitFor(() => !!document.querySelector('textarea[aria-label="Message Writer"]') && !selected());
  document.querySelector('.chat-thread .role-avatar.scout')?.closest('button')?.click();
  const retained = await waitFor(() => selected()?.textContent.includes('fixture-notes.md'));
  document.querySelector('button[aria-label="Remove fixture-notes.md"]')?.click();
  const removed = await waitFor(() => !selected());
  document.querySelector('.chat-prompt').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer('dropped.txt') }));
  const dropped = await waitFor(() => selected()?.textContent.includes('dropped.txt'));
  document.querySelector('textarea').dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: transfer('pasted.txt') }));
  const pasted = await waitFor(() => selected()?.textContent.includes('pasted.txt'));
  const fetchOriginal = window.fetch;
  window.fetch = (url, options) => String(url).endsWith('/roles/scout/chat') ? Promise.resolve(new Response(JSON.stringify({ error: 'Fixture send failure.' }), { status: 400, headers: { 'content-type': 'application/json' } })) : fetchOriginal(url, options);
  document.querySelector('textarea').form.requestSubmit();
  const failureRetained = await waitFor(() => document.querySelector('.chat-compose [role="alert"]')?.textContent.includes('Fixture send failure.') && selected()?.children.length === 2 && !document.querySelector('button[aria-label="Send message"]').disabled);
  window.fetch = fetchOriginal;
  document.querySelector('textarea').form.requestSubmit();
  const sent = await waitFor(() => !selected() && !!document.querySelector('button[aria-label="Download dropped.txt"]') && !!document.querySelector('button[aria-label="Download pasted.txt"]'));
  await waitFor(() => !document.querySelector('textarea').disabled);
  const state = await (await fetch('/api/snapshot', { headers: { 'x-pitchcrew-client': 'ui' } })).json();
  const message = state.messages.find((item) => item.attachments?.some((file) => file.name === 'dropped.txt'));
  const file = message?.attachments?.find((file) => file.name === 'dropped.txt');
  const response = file && await fetch('/api/chat/messages/' + message.id + '/attachments/' + file.id, { headers: { 'x-pitchcrew-client': 'ui' } });
  const downloaded = response?.ok && await response.text() === 'Fictional chat attachment.';
  return validation && picked && isolated && retained && removed && dropped && pasted && failureRetained && sent && message?.content === '' && downloaded;
})()`;
