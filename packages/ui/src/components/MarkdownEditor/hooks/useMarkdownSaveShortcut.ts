import { useEffect, useRef } from 'react';

export const useMarkdownSaveShortcut = () => {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const save = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 's' &&
        form.current?.contains(document.activeElement)
      ) {
        event.preventDefault();
        form.current.requestSubmit();
      }
    };
    document.addEventListener('keydown', save);
    return () => document.removeEventListener('keydown', save);
  }, []);
  return form;
};
