import { useNavigate, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import type { TableView } from '@/PipelineTable/types.ts';

export type PipelineMode = 'board' | 'table';

/** The last layout chosen on this device, read only when the URL names none. */
const modeKey = 'pitchcrew-pipeline-mode-v1';

const savedMode = (): PipelineMode | null => {
  try {
    const value = localStorage.getItem(modeKey);
    return value === 'board' || value === 'table' ? value : null;
  } catch {
    return null;
  }
};

const saveMode = (mode: PipelineMode) => {
  try {
    localStorage.setItem(modeKey, mode);
  } catch {
    /* The URL still carries the choice for this visit when storage is unavailable. */
  }
};

/**
 * Pipeline's layout: `?mode=` when a link names it, else the layout last chosen on this device,
 * else the board. Choosing a layout saves it and replaces the URL's search, so a reload or a copied
 * link keeps it; the table's saved view lives in `?view=` beside it.
 */
export const usePipelineMode = () => {
  const search = useSearch({ from: '/pipeline' });
  const navigate = useNavigate({ from: '/pipeline' });
  const [saved, setSaved] = useState(savedMode);
  const mode: PipelineMode = search.mode ?? saved ?? 'board';
  const choose = (next: PipelineMode) => {
    saveMode(next);
    setSaved(next);
    void navigate({
      search: (previous) => ({ mode: next, view: next === 'table' ? previous.view : undefined }),
      replace: true,
    });
  };
  const chooseView = (view: TableView) =>
    void navigate({
      search: { mode: 'table', view: view === 'all' ? undefined : view },
      replace: true,
    });
  return { mode, view: search.view, choose, chooseView };
};
