import type { Card } from '@pitchcrew/core';

export const boardSortOptions = [
  { value: 'fit-desc', label: 'Fit (high to low)' },
  { value: 'fit-asc', label: 'Fit (low to high)' },
  { value: 'created-desc', label: 'Date added (newest first)' },
  { value: 'created-asc', label: 'Date added (oldest first)' },
  { value: 'updated-desc', label: 'Recently updated' },
  { value: 'company-asc', label: 'Company (A–Z)' },
  { value: 'company-desc', label: 'Company (Z–A)' },
  { value: 'title-asc', label: 'Job title (A–Z)' },
  { value: 'title-desc', label: 'Job title (Z–A)' },
] as const;

export type BoardSort = (typeof boardSortOptions)[number]['value'];
export const defaultBoardSort: BoardSort = 'fit-desc';
export const isBoardSort = (value: unknown): value is BoardSort =>
  boardSortOptions.some((option) => option.value === value);

const alphabetical = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
const compareCards = (a: Card, b: Card, sort: BoardSort) => {
  switch (sort) {
    case 'fit-desc':
    case 'fit-asc':
      // Unscored jobs follow scored jobs in either direction; zero is a real score.
      if (a.fit === null) return b.fit === null ? 0 : 1;
      if (b.fit === null) return -1;
      return sort === 'fit-desc' ? b.fit - a.fit : a.fit - b.fit;
    case 'created-desc':
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    case 'created-asc':
      return Date.parse(a.createdAt) - Date.parse(b.createdAt);
    case 'updated-desc':
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    case 'company-asc':
      return alphabetical.compare(a.company, b.company);
    case 'company-desc':
      return alphabetical.compare(b.company, a.company);
    case 'title-asc':
      return alphabetical.compare(a.title, b.title);
    case 'title-desc':
      return alphabetical.compare(b.title, a.title);
  }
};

export const sortBoardCards = (cards: Card[], sort: BoardSort) =>
  cards.toSorted(
    (a, b) =>
      compareCards(a, b, sort) ||
      Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
      a.id.localeCompare(b.id),
  );
