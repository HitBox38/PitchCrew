import { useState } from 'react';

export function useCategoryOpen(id: string) {
  const key = `pitchcrew-sidebar-category-${id}-v1`;
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(key) !== 'false';
    } catch {
      return true;
    }
  });

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    try {
      localStorage.setItem(key, String(nextOpen));
    } catch {
      /* The category still toggles when storage is unavailable. */
    }
  }

  return { open, changeOpen };
}
