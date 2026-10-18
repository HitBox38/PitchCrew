import { useRef, useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import type { Conversation } from '@pitchcrew/core';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';

export function useConversationActions() {
  const action = useWorkspaceStore((state) => state.action);
  const working = useWorkspaceStore((state) => state.working);
  const { thread } = useParams({ strict: false });
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState<Conversation | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const focusList = () =>
    requestAnimationFrame(() => {
      const target = trigger.current?.isConnected
        ? trigger.current
        : document.querySelector<HTMLElement>(
            '.sidebar-conversations a, .sidebar-conversations button',
          );
      target?.focus();
    });
  const archive = async (item: Conversation) => {
    trigger.current = document.getElementById(`conversation-actions-${item.id}`);
    try {
      await action(
        `/conversations/${item.id}`,
        'PUT',
        { archived: !item.archived },
        item.archived ? 'Conversation restored.' : 'Conversation archived.',
      );
      focusList();
    } catch {
      /* The workspace action displays the error. */
    }
  };
  const requestDelete = (item: Conversation) => {
    trigger.current = document.getElementById(`conversation-actions-${item.id}`);
    setDeleting(item);
  };
  const close = () => {
    setDeleting(null);
    focusList();
  };
  const confirm = async () => {
    if (!deleting || working) return;
    try {
      await action(`/conversations/${deleting.id}`, 'DELETE', undefined, 'Conversation deleted.');
      if (thread === deleting.id) await navigate({ to: '/' });
      close();
    } catch {
      /* Keep the dialog open; the workspace action displays the error. */
    }
  };
  return { archive, requestDelete, deleting, working, close, confirm };
}
