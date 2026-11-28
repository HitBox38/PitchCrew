export const importLimits = {
  rows: 1000,
  bytes: 2 * 1024 * 1024,
  history: 100,
  note: 6000,
  tags: 10,
  tagLength: 40,
} as const;
export const importFileSizeLabel = `${importLimits.bytes / 1024 / 1024} MB`;

/** Accepted source cells, before import normalization combines notes and history. */
export const importRowTextLimits = { notes: 4000, lessons: 2000, historyNote: 1000 } as const;
