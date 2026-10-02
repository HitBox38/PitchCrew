import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { playNotificationSound, unlockNotificationAudio } from '../audio.ts';
import { collectNotifications, readStored, saveStored, NotificationTracker } from '../helpers.ts';
import type { CrewNotification, NotificationPreferences } from '../types.ts';

const readKey = 'pitchcrew-notifications-read-v1';
const preferencesKey = 'pitchcrew-notifications-preferences-v1';
const isIds = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((id) => typeof id === 'string');
const isPreferences = (value: unknown): value is NotificationPreferences =>
  !!value && typeof value === 'object' && 'sound' in value && typeof value.sound === 'boolean';

export function useNotifications() {
  const data = useWorkspaceStore((s) => s.data);
  const navigate = useNavigate();
  const items = useMemo(() => (data ? collectNotifications(data) : []), [data]);
  const [read, setRead] = useState(() => readStored(readKey, [] as string[], isIds));
  const [preferences, setPreferences] = useState(() => ({
    sound: readStored(preferencesKey, { sound: true }, isPreferences).sound,
  }));
  const [open, setOpen] = useState(false);
  const [latest, setLatest] = useState<CrewNotification | null>(null);
  const seen = useRef(new NotificationTracker());
  const unread = items.filter((item) => !read.includes(item.id));
  const markRead = (ids: string[]) =>
    setRead((previous) => [...new Set([...previous, ...ids])].slice(-500));
  const openNotification = (item: Pick<CrewNotification, 'id' | 'target'>) => {
    markRead([item.id]);
    setOpen(false);
    setLatest(null);
    useWorkspaceStore.getState().closePanels();
    if (item.target === '/inbox') void navigate({ to: '/inbox' });
    else void navigate({ to: '/chat/$thread', params: { thread: item.target.slice(6) } });
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
    const fresh = seen.current.update(items);
    if (!fresh.length) return;
    const priority = fresh.find((item) => item.kind === 'attention') ?? fresh[0]!;
    setLatest(priority);
    if (preferences.sound) playNotificationSound(priority.kind);
  }, [data, items, preferences]);
  const latestExists = !!latest && items.some((item) => item.id === latest.id);
  useEffect(() => {
    if (!latest) return;
    const timer = setTimeout(() => setLatest(null), latest.kind === 'attention' ? 12000 : 6000);
    return () => clearTimeout(timer);
  }, [latest]);
  return {
    items,
    unread,
    read,
    markRead,
    preferences,
    setPreferences,
    open,
    setOpen,
    latest: latestExists ? latest : null,
    setLatest,
    openNotification,
  };
}
