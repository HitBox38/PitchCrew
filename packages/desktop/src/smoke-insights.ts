/** Exercises user learning signals and bounded cleanup in the isolated desktop fixture. */
export const smokeInsights = `(async () => {
  const request = async (path, method = 'GET', body) => {
    const response = await fetch('/api' + path, {
      method, headers: { 'x-pitchcrew-client': 'ui', 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new Error('Insights smoke request failed: ' + path);
    return response.json();
  };
  const register = (index) => request('/tracking/external', 'POST', {
    company: 'Fictional Learning ' + index, title: 'Fictional Analyst', tags: ['ReactJS'],
    submittedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    note: 'Confirmed fictional external submission.',
  });
  const first = await register(0);
  document.querySelector('a[href="/"]')?.click();
  const cardSelector = '.job-card[aria-label="Open Fictional Analyst at Fictional Learning 0"]';
  if (!await waitFor(() => !!document.querySelector(cardSelector))) return false;
  document.querySelector(cardSelector).click();
  if (!await waitFor(() => !!document.querySelector('.learning-signals'))) return false;
  const strongWin = () => [...document.querySelectorAll('.weight-control button')].find((button) => button.textContent === '+2 Strong win');
  strongWin()?.click();
  const weightReady = await waitFor(() => strongWin()?.getAttribute('aria-pressed') === 'true');
  const textarea = document.querySelector('.learning-signals textarea');
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(textarea, 'Fictional lesson from desktop smoke.');
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  const add = () => [...document.querySelectorAll('.learning-signals button')].find((button) => button.textContent === 'Add lesson');
  if (!await waitFor(() => !add()?.disabled)) return false;
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    if (String(args[0]).endsWith('/lessons')) await new Promise((resolve) => setTimeout(resolve, 300));
    return originalFetch(...args);
  };
  let lessonPending;
  try {
    add().click();
    lessonPending = await waitFor(() => textarea.disabled);
    if (!await waitFor(() => !!document.querySelector('.lesson-list'))) return false;
  } finally { window.fetch = originalFetch; }
  const weighted = (await request('/snapshot')).cards.find((card) => card.id === first.id);
  const lessonReady = weighted.weight === 2 && weighted.lessons?.[0]?.text === 'Fictional lesson from desktop smoke.';
  document.querySelector('[aria-label="Close dialog"]')?.click();
  for (let index = 1; index < 201; index++) await register(index);
  document.querySelector('a[href="/insights"]')?.click();
  const insightsReady = await waitFor(() => location.pathname === '/insights' && !!document.querySelector('.insights-table'));
  const button = (text) => [...document.querySelectorAll('button')].find((item) => item.textContent === text);
  button('Find silent applications')?.click();
  if (!await waitFor(() => document.querySelectorAll('[aria-label="Silent applications"] [role="checkbox"]').length === 201)) return false;
  const selected = document.querySelectorAll('[aria-label="Silent applications"] [role="checkbox"][aria-checked="true"]').length;
  const unselected = document.querySelector('[aria-label="Silent applications"] [role="checkbox"][aria-checked="false"]');
  const bounded = selected === 200 && unselected?.hasAttribute('data-disabled');
  button('Review 200 selected')?.click();
  if (!await waitFor(() => !!document.querySelector('[role="dialog"]'))) return false;
  button('Mark as no response')?.click();
  if (!await waitFor(() => !document.querySelector('[role="dialog"]'))) return false;
  const cards = (await request('/snapshot')).cards.filter((card) => card.company.startsWith('Fictional Learning '));
  const applied = cards.filter((card) => card.state === 'ghosted').length === 200 && cards.filter((card) => card.state === 'submitted').length === 1;
  return weightReady && lessonPending && lessonReady && insightsReady && bounded && applied;
})()`;
