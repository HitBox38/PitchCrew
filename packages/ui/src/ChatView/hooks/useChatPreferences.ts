import { useEffect } from 'react';
import type { Snapshot } from '@pitchcrew/core';
import { useChatPreferenceStore } from '../preferences.ts';
export function useChatPreferences(thread: string, data: Snapshot) {
  const preferences = useChatPreferenceStore();
  const { markRead } = preferences;
  const latest = data.messages.findLast((message) => message.threadId === thread)?.createdAt;
  useEffect(() => {
    if (latest) markRead(thread, latest);
  }, [thread, latest, markRead]);
  return preferences;
}
