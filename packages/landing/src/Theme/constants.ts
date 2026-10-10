export const themeKey = 'pitchcrew-landing-theme-v1';
export const themeEvent = 'pitchcrew-landing-theme';

// Runs in the head before paint; only the root's theme attributes differ at hydration.
export const themeScript = `(() => {
  let choice = 'system';
  try {
    const saved = localStorage.getItem('${themeKey}');
    if (saved === 'light' || saved === 'dark') choice = saved;
  } catch {}
  const root = document.documentElement;
  root.dataset.themeChoice = choice;
  root.dataset.theme = choice === 'system'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : choice;
})();`;
