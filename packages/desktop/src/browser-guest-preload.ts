import { ipcRenderer } from 'electron';

// This isolated preload exposes no Electron API to the website. Only an unused,
// real Escape may cross back to the owning webview; website interactions go first.
let candidate: KeyboardEvent | undefined;
addEventListener(
  'keydown',
  (event) => {
    candidate = undefined;
    if (
      event.key !== 'Escape' ||
      !event.isTrusted ||
      event.repeat ||
      event.isComposing ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.shiftKey
    )
      return;
    const ownsEscape = (element: Element) =>
      element.matches(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="searchbox"]',
      );
    // Check before dispatch: Escape may close a dialog or blur a field itself.
    if (event.composedPath().some((node) => node instanceof Element && ownsEscape(node))) return;
    if (
      Array.from(
        document.querySelectorAll(
          'dialog[open], [popover]:popover-open, [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [aria-expanded="true"]',
        ),
      ).some((element) => element.checkVisibility({ visibilityProperty: true })) ||
      document.fullscreenElement ||
      document.pointerLockElement
    )
      return;
    candidate = event;
  },
  true,
);
addEventListener('keydown', (event) => {
  // A stopped event never reaches this fallback. Defer until all website window
  // listeners have had a chance to preventDefault, including later registrations.
  if (candidate !== event) return;
  candidate = undefined;
  setTimeout(() => {
    if (!event.defaultPrevented && document.hasFocus())
      ipcRenderer.sendToHost('pitchcrew:browser:escape');
  }, 0);
});
