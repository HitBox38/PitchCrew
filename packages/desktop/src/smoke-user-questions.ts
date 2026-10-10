/** Exercise a real saved question, multi-select answer and targeted continuation in the renderer. */
export const smokeUserQuestions = `(async () => {
  document.querySelector('nav[aria-label="Conversations"] a[href="/chat/scout"]')?.click();
  if (!await waitFor(() => !!document.querySelector('textarea[aria-label="Message Scout"]'))) throw new Error('Question fixture chat did not open.');
  let poppedUp = false, exitInert = false;
  const motionObserver = new MutationObserver(() => {
    const card = document.querySelector('.pending-user-questions-lane');
    if (card && new DOMMatrixReadOnly(getComputedStyle(card).transform).m42 > 1) poppedUp = true;
    if (document.querySelector('.pending-user-questions[inert][aria-hidden="true"]')) exitInert = true;
  });
  motionObserver.observe(document.querySelector('.chat-panel'), { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'inert', 'aria-hidden'] });
  const response = await fetch('/api/conversations/scout/messages', {
    method: 'POST', headers: { 'x-pitchcrew-client': 'ui', 'content-type': 'application/json' },
    body: JSON.stringify({ content: 'Fixture: ask for a cover-letter focus.' }),
  });
  if (response.status !== 202) throw new Error('Question fixture request was rejected.');
  const pending = await waitFor(() => !!document.querySelector('.pending-user-question') && !!document.querySelector('.user-question-message[data-status="pending"]'));
  const docked = await waitFor(() => {
    const card = document.querySelector('.pending-user-questions-lane');
    return !!card && Math.abs(new DOMMatrixReadOnly(getComputedStyle(card).transform).m42) < 0.1;
  });
  const motionReady = matchMedia('(prefers-reduced-motion: reduce)').matches || poppedUp;
  const waiting = document.querySelector('nav a[href="/chat/scout"]')?.textContent.includes('Waiting for you');
  const question = document.querySelector('.pending-user-question');
  const trigger = question?.querySelector('.pending-question-trigger');
  const card = document.querySelector('.pending-user-questions-lane');
  const composerInput = document.querySelector('.chat-prompt [data-slot="input-group"]');
  const composerIsToaster = !document.querySelector('.pending-question-slot') && card.getBoundingClientRect().bottom > composerInput.getBoundingClientRect().top;
  const collapseCheck = (async () => {
    const end = performance.now() + 400;
    while (performance.now() < end) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      if (card.scrollHeight > card.clientHeight) return false;
    }
    return true;
  })();
  trigger?.click();
  const scrollbarStable = await collapseCheck;
  const collapsed = await waitFor(() => trigger?.getAttribute('aria-expanded') === 'false');
  [...document.querySelectorAll('.user-question-message button')].find(button => button.textContent === 'Answer question')?.click();
  const focused = await waitFor(() => document.activeElement === question?.querySelector('textarea'));
  const choices = question?.querySelectorAll('[role="checkbox"]');
  choices?.[0]?.click(); choices?.[1]?.click();
  const custom = question?.querySelector('textarea');
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(custom, 'Mention the scheduling project.');
  custom.dispatchEvent(new Event('input', { bubbles: true }));
  const compose = document.querySelector('.chat-textarea');
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(compose, 'Keep this separate draft.');
  compose.dispatchEvent(new Event('input', { bubbles: true }));
  const submit = question?.querySelector('button[type="submit"]');
  if (!await waitFor(() => !submit?.disabled)) throw new Error('Answer submission did not enable.');
  submit.click();
  const answered = await waitFor(() => !document.querySelector('.pending-user-question') && !!document.querySelector('.user-question-message[data-status="answered"]'));
  motionObserver.disconnect();
  let continued = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    const data = await fetch('/api/snapshot', { headers: { 'x-pitchcrew-client': 'ui' } }).then(r => r.json());
    const q = data.userInputs.find(q => q.question === 'Which achievement should the cover letter emphasize?');
    const continuation = data.chatRequests.find(request => request.id === q?.continuationRequestId);
    continued = q?.status === 'answered' && q.answer.selected.length === 2 && q.answer.text === 'Mention the scheduling project.' && continuation?.deliveries.length === 1 && continuation.deliveries[0].roleId === 'scout' && continuation.deliveries[0].status === 'completed';
    if (continued) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const draftKept = compose.value === 'Keep this separate draft.';
  const checks = { pending, motionReady, docked, exitInert, composerIsToaster, scrollbarStable, waiting, collapsed, focused, answered, continued, draftKept };
  if (!Object.values(checks).every(Boolean)) throw new Error('User question checks: ' + JSON.stringify(checks));
  return true;
})()`;
