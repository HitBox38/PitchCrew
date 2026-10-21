import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { workspaceToasts } from '../toasts.ts';
import { useDevicePreferences } from '@/lib/device-preferences.ts';
import { useEffect, useMemo, useRef, useState } from 'react';
import { playNotificationSound, unlockNotificationAudio } from '../audio.ts';
import {
  collectNotifications,
  readStored,
  saveStored,
  NotificationTracker,
  notificationToastOptions,
  notificationShouldAlert,
} from '../helpers.ts';
import type { CrewNotification } from '../types.ts';
import { useLinkFeedback } from './useLinkFeedback.ts';

export const useNotifications = () => {
  useLinkFeedback();
  const data = useWorkspaceStore((s) => s.data);
  const toastManager = workspaceToasts;
  const activeToasts = useRef(new Set<string>());
  const items = useMemo(() => (data ? collectNotifications(data) : []), [data]);
  const [read, setRead] = useState(() => readStored(readKey, [] as string[], isIds));
  const sound = useDevicePreferences((state) => state.sound);
  const setSound = useDevicePreferences((state) => state.setSound);
  const [open, setPanelOpen] = useState(false);
  const setOpen = (value: boolean) => {
    if (value) activeToasts.current.forEach((id) => toastManager.close(id));
    setPanelOpen(value);
  };
  const [tracker] = useState(() => new NotificationTracker());
  const readIds = new Set(read);
  const unread = items.filter((item) => !readIds.has(item.id));
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
    if (!sound) return;
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
  }, [sound]);
  useEffect(() => {
    if (!data) return;
    const currentIds = new Set(items.map((item) => item.id));
    const visibleBrowserApprovals = new Set(
      Array.from(document.querySelectorAll<HTMLElement>('[data-browser-approval-id]'))
        .filter((element) => element.getClientRects().length > 0)
        .map((element) => `computer:${element.dataset.browserApprovalId}`),
    );
    for (const id of activeToasts.current) {
      if (!currentIds.has(id) || visibleBrowserApprovals.has(id)) {
        toastManager.close(id);
        activeToasts.current.delete(id);
      }
    }
    const fresh = tracker.update(items).filter(notificationShouldAlert);
    if (!fresh.length) return;
    const priority = fresh.find((item) => item.kind === 'attention') ?? fresh[0]!;
    if (!open)
      fresh.toReversed().forEach((item) => {
        if (visibleBrowserApprovals.has(item.id)) return;
        activeToasts.current.add(item.id);
        toastManager.add({
          ...notificationToastOptions(item),
          onRemove: () => activeToasts.current.delete(item.id),
        });
      });
    if (sound) playNotificationSound(priority.kind);
  }, [data, items, sound, open, toastManager, tracker]);
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
};

const readKey = 'pitchcrew-notifications-read-v1';
const isIds = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((id) => typeof id === 'string');
