/** Exercises first-run setup only inside the isolated Electron fixture workspace. */
export const smokeOnboarding = `(async () => {
  const click = (text) => [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === text)?.click();
  const welcome = await waitFor(() => document.querySelector('.onboarding-dialog')?.textContent.includes('Your job search has a crew.'));
  click('Meet your workspace');
  const approval = await waitFor(() => document.querySelector('.onboarding-dialog')?.textContent.includes('You make the final call.'));
  click('Start setup');
  const checklist = await waitFor(() => !document.querySelector('[role="dialog"]') && !!document.querySelector('.onboarding-checklist'));
  click('Set up later');
  const deferred = await waitFor(() => !document.querySelector('.onboarding-checklist'));
  click('Getting started');
  const reopened = await waitFor(() => !!document.querySelector('.onboarding-dialog'));
  click('Set up later');
  const closed = await waitFor(() => !document.querySelector('[role="dialog"]'));
  const saved = await fetch('/api/snapshot', { headers: { 'x-pitchcrew-client': 'ui' } }).then((response) => response.json());
  return welcome && approval && checklist && deferred && reopened && closed && saved.onboarding?.status === 'dismissed';
})()`;
