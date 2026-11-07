import { workspaceToasts } from '../toasts.ts';
import { useDevicePreferences } from '@/lib/device-preferences.ts';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  getVisibleBrowserApprovals,
  subscribeBrowserApprovalVisibility,
} from '@/AgentBrowser/approval-visibility.ts';
import { playNotificationSound, unlockNotificationAudio } from '../audio.ts';
import {
  NotificationTracker,
  notificationToastOptions,
  notificationShouldAlert,
  notificationInView,
} from '../helpers.ts';
import { useNotificationStore } from '../store.ts';
import { useLinkFeedback } from './useLinkFeedback.ts';
import { useNotificationItems } from './useNotificationItems.ts';
import {
  getVisibleQuestionToasts,
  subscribeQuestionToastVisibility,
} from '@/UserQuestions/toast-visibility.ts';

/** Toasts and sounds for new notices; mounted once by the notification center. */
export const useNotifications = () => {
  useLinkFeedback();
  const { data, items } = useNotificationItems();
  const toastManager = workspaceToasts;
  const activeToasts = useRef(new Set<string>());
  const sound = useDevicePreferences((state) => state.sound);
  const open = useNotificationStore((state) => state.panelOpen);
  const [tracker] = useState(() => new NotificationTracker());
  const visibleApprovals = useSyncExternalStore(
    subscribeBrowserApprovalVisibility,
    getVisibleBrowserApprovals,
  );
  const visibleQuestions = useSyncExternalStore(
    subscribeQuestionToastVisibility,
    getVisibleQuestionToasts,
  );
  useEffect(() => {
    if (open) activeToasts.current.forEach((id) => toastManager.close(id));
  }, [open, toastManager]);
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
    const pathname = decodeURIComponent(window.location.pathname);
    const visible = document.visibilityState === 'visible';
    // Read after layout publication, not a render-time snapshot that may precede a new dock.
    const questionToasts = getVisibleQuestionToasts();
    const byId = new Map(items.map((item) => [item.id, item]));
    const currentIds = new Set(items.map((item) => item.id));
    const visibleBrowserApprovals = new Set([
      ...[...getVisibleBrowserApprovals()].map((id) => `computer:${id}`),
      ...Array.from(document.querySelectorAll<HTMLElement>('[data-browser-approval-id]'))
        .filter((element) => element.getClientRects().length > 0)
        .map((element) => `computer:${element.dataset.browserApprovalId}`),
    ]);
    for (const id of activeToasts.current) {
      const item = byId.get(id);
      const questionInView =
        item?.context === 'input' && notificationInView(item, pathname, visible, questionToasts);
      if (!currentIds.has(id) || visibleBrowserApprovals.has(id) || questionInView) {
        toastManager.close(id);
        activeToasts.current.delete(id);
      }
    }
    const fresh = tracker
      .update(items)
      .filter(notificationShouldAlert)
      .filter((item) => !notificationInView(item, pathname, visible, questionToasts));
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
  }, [data, items, sound, open, toastManager, tracker, visibleApprovals, visibleQuestions]);
  return { toastManager };
};
