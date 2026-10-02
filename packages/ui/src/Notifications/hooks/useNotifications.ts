import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
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
import type { CrewNotification, NotificationPreferences } from '../types.ts';

const readKey = 'pitchcrew-notifications-read-v1';
const preferencesKey = 'pitchcrew-notifications-preferences-v1';
const isIds = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((id) => typeof id === 'string');
const isPreferences = (value: unknown): value is NotificationPreferences =>
  !!value && typeof value === 'object' && 'sound' in value && typeof value.sound === 'boolean';

export function useNotifications() {
  const data = useWorkspaceStore((s) => s.data);
  const [toastManager] = useState(() => createToastManager<CrewNotification>());
  const activeToasts = useRef(new Set<string>());
  const items = useMemo(() => (data ? collectNotifications(data) : []), [data]);
  const [read, setRead] = useState(() => readStored(readKey, [] as string[], isIds));
  const [preferences, setPreferences] = useState(() => ({
    sound: readStored(preferencesKey, { sound: true }, isPreferences).sound,
  }));
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
    saveStored(preferencesKey, preferences);
  }, [preferences]);
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
    if (preferences.sound) playNotificationSound(priority.kind);
  }, [data, items, preferences, open, toastManager]);
  return {
    items,
    unread,
    read,
    markRead,
    preferences,
    setPreferences,
    open,
    setOpen,
    toastManager,
    openNotification,
  };
}
