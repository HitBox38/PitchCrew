/** Verifies the real Electron denial → preload → app-toast path without opening a browser. */
export const smokeLinks = `async () => {
  const bridge = window.pitchcrewLinks;
  if (!bridge || Object.keys(bridge).join(',') !== 'subscribe')
    throw new Error('Desktop link feedback bridge is missing or exposes extra capabilities.');
  if (!await waitFor(() => !!document.querySelector('.notification-bell')))
    throw new Error('Desktop link feedback requires the mounted workspace.');
  const reasons = [];
  const unsubscribe = bridge.subscribe((reason) => reasons.push(reason));
  for (const [url, reason, message, native] of [
    ['file:///pitchcrew-fictional-blocked-link', 'unsupported-protocol', 'Pitchcrew opens only HTTP and HTTPS websites', false],
    ['https://', 'invalid-url', 'this is not a valid website address', false],
    ['https://fixture-user:fixture-password@example.com/private', 'embedded-credentials', 'it contains a username or password', true],
  ]) {
    if (native) window.open(url, '_blank');
    else {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      document.body.append(link);
      link.click();
      link.remove();
    }
    if (!await waitFor(() => [...document.querySelectorAll('[data-slot="toast"]')].some((toast) => toast.textContent.includes(message))))
      throw new Error('Missing blocked-link toast: ' + reason + '; received: ' + JSON.stringify(reasons));
    if (native && reasons.at(-1) !== reason) throw new Error('Wrong desktop blocked-link reason.');
    const toast = [...document.querySelectorAll('[data-slot="toast"]')].find((toast) => toast.textContent.includes(message));
    if (toast.textContent.includes('fixture-user') || toast.textContent.includes('fixture-password'))
      throw new Error('Desktop link toast exposed URL credentials.');
    toast.querySelector('[data-slot="toast-close"]').click();
    if (!await waitFor(() => !document.querySelector('[data-slot="toast"]')))
      throw new Error('Could not dismiss blocked-link toast.');
  }
  unsubscribe();
  return true;
}`;
