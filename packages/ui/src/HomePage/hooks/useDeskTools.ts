import { createContext, use } from 'react';
import type { Action } from '@/WorkspaceStore/index.ts';
import type { DeskView } from '../types.ts';

/** What every open row's body decides and navigates with. Stable for the life of the desk. */
export type DeskTools = {
  /** The store's action for one item (`deskAction`): what is sent never changes. */
  act: (view: DeskView) => Action;
  /** Opens job details; focus comes back to the desk when it closes. */
  openCard: (id: string, section?: 'job' | 'application' | 'activity') => void;
  /** A row unmounted while it held focus. */
  lost: (key: string) => void;
  /** An embedded question resolved and hands focus back to the desk. */
  resolved: () => void;
};

export const DeskToolsContext = createContext<DeskTools | null>(null);

/** The desk's tools, for an open row's body. */
export const useDeskTools = () => {
  const tools = use(DeskToolsContext);
  if (!tools) throw new Error('An open row needs the desk around it.');
  return tools;
};
