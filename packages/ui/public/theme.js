// Applies the saved or system colour theme before the app renders, so dark mode never
// flashes light. Same storage key and rules as src/theme.ts.
(() => {
  let choice = 'system';
  try {
    choice = localStorage.getItem('pitchcrew-theme') ?? 'system';
  } catch {
    /* Storage unavailable: follow the system. */
  }
  const dark =
    choice === 'dark' ||
    (choice !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();
