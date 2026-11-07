/** Exercises the shared React composer with fixture files in the isolated smoke workspace. */
import { smokeComposerContext } from './smoke-composer-context.ts';
export const smokeAttachments = `(async () => {
  const contextReady = await ${smokeComposerContext};
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
  document.querySelector('nav[aria-label="Chats"] a[href="/chat/writer"]')?.click();
  const isolated = await waitFor(() => !!document.querySelector('[role="textbox"][aria-label="Message Writer"]') && !selected());
  document.querySelector('nav[aria-label="Chats"] a[href="/chat/scout"]')?.click();
  const retained = await waitFor(() => selected()?.textContent.includes('fixture-notes.md'));
  document.querySelector('button[aria-label="Remove fixture-notes.md"]')?.click();
  const removed = await waitFor(() => !selected());
  document.querySelector('.chat-prompt').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer('dropped.txt') }));
  const dropped = await waitFor(() => selected()?.textContent.includes('dropped.txt'));
  document.querySelector('.chat-rich-input').dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: transfer('pasted.txt') }));
  const pasted = await waitFor(() => selected()?.textContent.includes('pasted.txt'));
  const fetchOriginal = window.fetch;
  let attempts = 0, failureRetained = false, keptFiles = false, failureDetails = false, restored = false, noAutoResend = false;
  window.fetch = (url, options) => {
    if (!String(url).endsWith('/conversations/scout/messages')) return fetchOriginal(url, options);
    attempts++;
    // A 5xx leaves acceptance uncertain; 4xx restores a definitively rejected draft directly.
    return Promise.resolve(new Response(JSON.stringify({ error: 'Fixture send failure.' }), { status: 503, headers: { 'content-type': 'application/json' } }));
  };
  try {
    document.querySelector('.chat-prompt').requestSubmit();
    const review = () => [...document.querySelectorAll('.chat-compose button')].find(button => button.textContent === 'Review 1 kept draft');
    failureRetained = await waitFor(() => !!review() && !selected() && document.querySelector('.chat-composer-recovery')?.textContent.includes('Could not confirm the send.'));
    review()?.click();
    const kept = () => document.querySelector('.chat-kept-draft');
    keptFiles = await waitFor(() => kept()?.querySelectorAll('li').length === 2 && kept()?.textContent.includes('dropped.txt') && kept()?.textContent.includes('pasted.txt'));
    kept()?.querySelector('.chat-queue-details-trigger')?.click();
    failureDetails = await waitFor(() => kept()?.querySelector('pre')?.textContent === 'Fixture send failure.');
    kept()?.querySelector('[data-kept-draft-use]')?.click();
    restored = await waitFor(() => !document.querySelector('.chat-draft-recovery') && selected()?.children.length === 2 && document.querySelector('button[aria-label="Retry original queued send"]')?.disabled === false);
    noAutoResend = attempts === 1;
  } finally {
    window.fetch = fetchOriginal;
  }
  document.querySelector('.chat-prompt').requestSubmit();
  const sent = await waitFor(() => !selected() && !!document.querySelector('button[aria-label="Download dropped.txt"]') && !!document.querySelector('button[aria-label="Download pasted.txt"]'));
  await waitFor(() => document.querySelector('.chat-rich-input').getAttribute('contenteditable') === 'true');
  const state = await (await fetch('/api/snapshot', { headers: { 'x-pitchcrew-client': 'ui' } })).json();
  const message = state.messages.find((item) => item.attachments?.some((file) => file.name === 'dropped.txt'));
  const file = message?.attachments?.find((file) => file.name === 'dropped.txt');
  const response = file && await fetch('/api/chat/messages/' + message.id + '/attachments/' + file.id, { headers: { 'x-pitchcrew-client': 'ui' } });
  const downloaded = response?.ok && await response.text() === 'Fictional chat attachment.';
  const checks = { contextReady, validation, picked, isolated, retained, removed, dropped, pasted, failureRetained, keptFiles, failureDetails, restored, noAutoResend, sent, fileOnly: message?.content === '', downloaded };
  if (!Object.values(checks).every(Boolean)) throw new Error('Composer attachment checks: ' + JSON.stringify(checks));
  return true;
})()`;
