import { useHistorySearch } from './useHistorySearch.ts';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useParams } from '@tanstack/react-router';
import { useSidebar } from '@pitchcrew/design-system/sidebar';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useChatPreferenceStore } from '@/ChatView/preferences.ts';
import { conversationRows } from '../helpers.ts';
import type { Snapshot } from '@pitchcrew/core';
export const useConversationNavigation = (data: Snapshot) => {
  const [query, setQuery] = useState('');
  const [finding, setFinding] = useState(false);
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
  }, [iconOnly, finding]);
  const readAt = useChatPreferenceStore((state) => state.readAt);
  const dmsOpen = useChatPreferenceStore((state) => state.dmsOpen);
  const setDmsOpen = useChatPreferenceStore((state) => state.setDmsOpen);
  const setCreatingConversation = useWorkspaceStore((state) => state.setCreatingConversation);
  const history = useHistorySearch(query, data.messageHistory?.revision);
  const rows = useMemo(
    () => conversationRows(data, query, true, readAt, history.matches),
    [data, query, readAt, history.matches],
  );
  const create = () => {
    setOpenMobile(false);
    setCreatingConversation(true);
  };
  /** Show or hide Find chats; hiding clears the search. */
  const toggleFind = () => {
    if (finding) {
      setQuery('');
      if (document.activeElement === searchRef.current)
        requestAnimationFrame(() =>
          document
            .querySelector<HTMLElement>('.sidebar-conversations [aria-label="Find chats"]')
            ?.focus(),
        );
    } else focusSearch.current = true;
    setFinding(!finding);
  };
  const openConversations = () => {
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
    searchError: history.error,
    setQuery,
    finding: finding || !!query,
    toggleFind,
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
};
