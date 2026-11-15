import { useEffect, useRef } from 'react';

export const useMarkdownSaveShortcut = () => {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const save = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 's' &&
        // In the form, or nowhere in particular (focus fell to the page) without a dialog open.
        (form.current?.contains(document.activeElement) ||
          (form.current &&
            document.activeElement === document.body &&
            !document.querySelector('[role="dialog"], [role="alertdialog"]')))
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
