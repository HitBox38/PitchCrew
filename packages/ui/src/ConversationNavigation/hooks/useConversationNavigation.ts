import { useState, useMemo, useRef, useEffect } from 'react';
import { useParams } from '@tanstack/react-router';
import { useSidebar } from '@/components/ui/sidebar/hooks/useSidebar.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useChatPreferenceStore } from '@/ChatView/preferences.ts';
import { conversationRows } from '../helpers.ts';
import type { Snapshot } from '@pitchcrew/core';
export function useConversationNavigation(data: Snapshot) {
  const [query, setQuery] = useState('');
  const [archived, setArchived] = useState(false);
  const { thread } = useParams({ strict: false });
  const { isMobile, state, setOpen, setOpenMobile } = useSidebar();
  const iconOnly = !isMobile && state === 'collapsed';
  const searchRef = useRef<HTMLInputElement>(null);
  const focusSearch = useRef(false);
  useEffect(() => {
    if (!iconOnly && focusSearch.current) {
      searchRef.current?.focus();
      focusSearch.current = false;
    }
  }, [iconOnly]);
  const readAt = useChatPreferenceStore((state) => state.readAt);
  const dmsOpen = useChatPreferenceStore((state) => state.dmsOpen);
  const setDmsOpen = useChatPreferenceStore((state) => state.setDmsOpen);
  const setCreatingConversation = useWorkspaceStore((state) => state.setCreatingConversation);
  const rows = useMemo(
    () => conversationRows(data, query, archived, readAt),
    [data, query, archived, readAt],
  );
  const create = () => {
    setOpenMobile(false);
    setCreatingConversation(true);
  };
  const openConversations = () => {
    focusSearch.current = true;
    setOpen(true);
    try {
      localStorage.setItem('pitchcrew-sidebar-category-conversations-v1', 'true');
    } catch {
      /* Device preference is optional. */
    }
    // A category remount after expansion restores its stored preference.
  };
  return {
    query,
    setQuery,
    archived,
    setArchived,
    thread,
    rows,
    create,
    openConversations,
    iconOnly,
    searchRef,
    closeMobile: () => setOpenMobile(false),
    dmsOpen,
    setDmsOpen,
  };
}
