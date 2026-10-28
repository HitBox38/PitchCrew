export const BrowserLoadingProgress = () => (
  <output className="browser-loading-progress" aria-label="Loading page" aria-live="polite">
    <span aria-hidden="true" />
    <span className="sr-only">Loading page…</span>
  </output>
);
