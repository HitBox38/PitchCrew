import { useState } from 'react';

export const useCategoryOpen = (id: string) => {
  const changeOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    try {
      localStorage.setItem(key, String(nextOpen));
    } catch {
      /* The category still toggles when storage is unavailable. */
    }
  };

  const key = `pitchcrew-sidebar-category-${id}-v1`;
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(key) !== 'false';
    } catch {
      return true;
    }
  });

  return { open, changeOpen };
};
