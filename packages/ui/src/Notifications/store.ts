import { create } from 'zustand';
import { readStored, saveStored } from './helpers.ts';

const readKey = 'pitchcrew-notifications-read-v1';
const isIds = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((id) => typeof id === 'string');

/**
 * Read state shared by every bell (sidebar strip, rail, drawer) and the single toast host.
 * Opening the panel marks nothing read; only an opened entry or Mark all read does.
 */
export const useNotificationStore = create<{
  read: string[];
  panelOpen: boolean;
  markRead: (ids: string[]) => void;
  setPanelOpen: (open: boolean) => void;
}>((set, get) => ({
  read: readStored(readKey, [] as string[], isIds),
  panelOpen: false,
  markRead: (ids) => {
    const read = [...new Set([...get().read, ...ids])].slice(-500);
    saveStored(readKey, read);
    set({ read });
  },
  setPanelOpen: (panelOpen) => set({ panelOpen }),
}));
