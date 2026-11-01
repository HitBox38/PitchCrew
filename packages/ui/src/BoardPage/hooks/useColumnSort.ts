import { useState } from 'react';
import { defaultBoardSort, isBoardSort, type BoardSort } from '../sorting.ts';

const sortKey = (id: string) => `pitchcrew-board-sort-${id}-v1`;

/** A merged column adopts the first saved choice of the columns it replaced; their keys stay. */
const savedSort = (id: string, legacy: string[]): BoardSort => {
  try {
    for (const key of [id, ...legacy]) {
      const saved = localStorage.getItem(sortKey(key));
      if (isBoardSort(saved)) return saved;
    }
  } catch {
    /* Device storage may be unavailable; the default still applies. */
  }
  return defaultBoardSort;
};

export const useColumnSort = (id: string, legacy: string[] = []) => {
  const [sort, setSort] = useState<BoardSort>(() => savedSort(id, legacy));
  const changeSort = (value: unknown) => {
    if (!isBoardSort(value)) return;
    setSort(value);
    try {
      localStorage.setItem(sortKey(id), value);
    } catch {
      /* Sorting still works when device storage is unavailable. */
    }
  };
  return { sort, changeSort };
};
