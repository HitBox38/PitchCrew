import { useState } from 'react';
import { defaultBoardSort, isBoardSort, type BoardSort } from '../sorting.ts';

export const useColumnSort = (id: string) => {
  const key = `pitchcrew-board-sort-${id}-v1`;
  const [sort, setSort] = useState<BoardSort>(() => {
    try {
      const saved = localStorage.getItem(key);
      return isBoardSort(saved) ? saved : defaultBoardSort;
    } catch {
      return defaultBoardSort;
    }
  });
  const changeSort = (value: unknown) => {
    if (!isBoardSort(value)) return;
    setSort(value);
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Sorting still works when device storage is unavailable. */
    }
  };
  return { sort, changeSort };
};
