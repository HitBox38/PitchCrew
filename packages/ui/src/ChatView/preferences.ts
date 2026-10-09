import { create } from 'zustand';
function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Device preferences are best effort. */
  }
}
interface ChatPreferences {
  width: string;
  sendMode: 'queue' | 'interrupt';
  readAt: Record<string, string>;
  dmsOpen: boolean;
  setWidth: (value: string) => void;
  setSendMode: (value: 'queue' | 'interrupt') => void;
  markRead: (thread: string, date: string) => void;
  setDmsOpen: (open: boolean) => void;
}
export const useChatPreferenceStore = create<ChatPreferences>((set, get) => ({
  width: ['comfortable', 'wide', 'full'].includes(read<string>('pitchcrew.chat.width', 'wide'))
    ? read<string>('pitchcrew.chat.width', 'wide')
    : 'wide',
  sendMode:
    read<string>('pitchcrew.chat.sendMode', 'queue') === 'interrupt' ? 'interrupt' : 'queue',
  readAt: read('pitchcrew.chat.read', {}),
  dmsOpen: read<boolean>('pitchcrew.chat.dmsOpen', false) === true,
  setWidth: (width) => {
    set({ width });
    write('pitchcrew.chat.width', width);
  },
  setSendMode: (sendMode) => {
    set({ sendMode });
    write('pitchcrew.chat.sendMode', sendMode);
  },
  markRead: (thread, date) => {
    if (get().readAt[thread] === date) return;
    const readAt = { ...get().readAt, [thread]: date };
    set({ readAt });
    write('pitchcrew.chat.read', readAt);
  },
  setDmsOpen: (dmsOpen) => {
    set({ dmsOpen });
    write('pitchcrew.chat.dmsOpen', dmsOpen);
  },
}));
