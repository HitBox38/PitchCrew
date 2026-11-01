import { useState } from 'react';

export const categoryKey = (id: string) => `pitchcrew-sidebar-category-${id}-v1`;

/** A sidebar category's device-remembered disclosure; `fallback` applies before any choice. */
export const useCategoryOpen = (id: string, fallback = true) => {
  const key = categoryKey(id);
  const [open, setOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? fallback : stored !== 'false';
    } catch {
      return fallback;
    }
  });
  const changeOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    try {
      localStorage.setItem(key, String(nextOpen));
    } catch {
      /* The category still toggles when storage is unavailable. */
    }
  };
  return { open, changeOpen };
};
