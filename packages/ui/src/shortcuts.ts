import { useEffect, useLayoutEffect, useRef } from 'react';
export const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);
export const modKey = isMac ? '⌘' : 'Ctrl ';
function typing(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}
// Global shortcuts: ⌘K / Ctrl+K anywhere, single keys only when not typing or in a dialog.
export function useShortcuts(handlers: { search: () => void; newJob: () => void }) {
  const ref = useRef(handlers);
  useLayoutEffect(() => {
    ref.current = handlers;
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        ref.current.search();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      if (typing(event.target) || document.querySelector('[role="dialog"]')) return;
      if (event.key === 'n' || event.key === 'N') {
        event.preventDefault();
        ref.current.newJob();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
