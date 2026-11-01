import { useMemo, useState } from 'react';
import type { Snapshot } from '@pitchcrew/core';
import { useConversationActions } from '@/ConversationNavigation/hooks/useConversationActions.ts';
import { useConversationNavigation } from '@/ConversationNavigation/hooks/useConversationNavigation.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { sidebarJobs } from '../jobs.ts';
import { nestConversations, openJobIds } from '../sidebar-conversations.ts';
import { useNow } from './useNow.ts';

/**
 * Shared state for the clay sidebar: live jobs with their conversations nested beneath, and the
 * remaining conversation list. Jobs expand independently: a job that opens (because it is the open
 * job or waits on the user) stays open until the user folds it, and a folded job reopens only when
 * it becomes the open job again. Opening another thread never collapses a group.
 */
export const useClaySidebar = (data: Snapshot) => {
  const navigation = useConversationNavigation(data);
  const actions = useConversationActions();
  const selectedCardId = useWorkspaceStore((state) => state.selectedId);
  const now = useNow();
  const { jobs, leads } = useMemo(() => sidebarJobs(data), [data]);
  const nested = useMemo(
    () => nestConversations(navigation.rows, jobs, navigation.query),
    [navigation.rows, jobs, navigation.query],
  );
  const threadCardId = data.conversations?.find((item) => item.id === navigation.thread)?.cardId;
  const focused = new Set([threadCardId, selectedCardId].filter(Boolean));
  const focus = [threadCardId, selectedCardId].join('|');
  const defaults = openJobIds(jobs, nested.byCard, { threadCardId, selectedCardId });
  const [expanded, setExpanded] = useState({ focus, open: {} as Record<string, boolean> });
  const refocused = expanded.focus !== focus;
  const opening = [...defaults].filter(
    (id) => !(id in expanded.open) || (refocused && focused.has(id) && !expanded.open[id]),
  );
  if (refocused || opening.length)
    setExpanded({
      focus,
      open: { ...expanded.open, ...Object.fromEntries(opening.map((id) => [id, true])) },
    });
  const isOpen = (id: string) => opening.includes(id) || !!expanded.open[id];
  const setJobOpen = (id: string, open: boolean) =>
    setExpanded((current) => ({ ...current, open: { ...current.open, [id]: open } }));
  return { navigation, actions, jobs, leads, nested, now, isOpen, setJobOpen };
};

export type ClaySidebarState = ReturnType<typeof useClaySidebar>;
