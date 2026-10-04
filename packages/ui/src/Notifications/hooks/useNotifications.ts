import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useDevicePreferences } from '@/lib/device-preferences.ts';
import { createToastManager } from '@/components/ui/toast/index.tsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { playNotificationSound, unlockNotificationAudio } from '../audio.ts';
import {
  collectNotifications,
  readStored,
  saveStored,
  NotificationTracker,
  notificationToastOptions,
} from '../helpers.ts';
import type { CrewNotification } from '../types.ts';

const readKey = 'pitchcrew-notifications-read-v1';
const isIds = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((id) => typeof id === 'string');

export function useNotifications() {
  const data = useWorkspaceStore((s) => s.data);
  const [toastManager] = useState(() => createToastManager<CrewNotification>());
  const activeToasts = useRef(new Set<string>());
  const items = useMemo(() => (data ? collectNotifications(data) : []), [data]);
  const [read, setRead] = useState(() => readStored(readKey, [] as string[], isIds));
  const sound = useDevicePreferences((state) => state.sound);
  const setSound = useDevicePreferences((state) => state.setSound);
  const [open, setPanelOpen] = useState(false);
  const setOpen = (value: boolean) => {
    if (value) toastManager.close();
    setPanelOpen(value);
  };
  const seen = useRef(new NotificationTracker());
  const unread = items.filter((item) => !read.includes(item.id));
  const markRead = (ids: string[]) =>
    setRead((previous) => [...new Set([...previous, ...ids])].slice(-500));
  const openNotification = (item: Pick<CrewNotification, 'id' | 'target'>) => {
    markRead([item.id]);
    setOpen(false);
    toastManager.close(item.id);
    useWorkspaceStore.getState().closePanels();
  };
  useEffect(() => {
    saveStored(readKey, read);
  }, [read]);
  useEffect(() => {
    const unlock = () => {
      try {
        unlockNotificationAudio();
      } catch {
        /* Optional audio. */
      }
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);
  useEffect(() => {
    if (!data) return;
    const currentIds = new Set(items.map((item) => item.id));
    for (const id of activeToasts.current) {
      if (!currentIds.has(id)) {
        toastManager.close(id);
        activeToasts.current.delete(id);
      }
    }
    const fresh = seen.current.update(items);
    if (!fresh.length) return;
    const priority = fresh.find((item) => item.kind === 'attention') ?? fresh[0]!;
    if (!open)
      fresh.toReversed().forEach((item) => {
        activeToasts.current.add(item.id);
        toastManager.add({
          ...notificationToastOptions(item),
          onRemove: () => activeToasts.current.delete(item.id),
        });
      });
    if (sound) playNotificationSound(priority.kind);
  }, [data, items, sound, open, toastManager]);
  return {
    items,
    unread,
    read,
    markRead,
    preferences: { sound },
    setPreferences: (value: { sound: boolean }) => setSound(value.sound),
    open,
    setOpen,
    toastManager,
    openNotification,
  };
}
