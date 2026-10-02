import { isChatThread } from '@/navigation.ts';
import { chatRoute, ChatView } from '@/pages/constants.ts';
import { useWorkspaceNavigation } from '@/workspace-navigation.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useShallow } from 'zustand/react/shallow';

export function ChatPage() {
  const { data, action, working, setRoleId, openCard } = useWorkspaceStore(
    useShallow((state) => ({
      data: state.data,
      action: state.action,
      working: state.working,
      setRoleId: state.setRoleId,
      openCard: state.openCard,
    })),
  );
  const { openChat } = useWorkspaceNavigation();
  const { thread } = chatRoute.useParams();
  if (!data || !isChatThread(thread)) return null;
  return (
    <ChatView
      data={data}
      thread={thread}
      onThread={openChat}
      onConfigure={setRoleId}
      onOpenCard={openCard}
      action={action}
      working={working}
    />
  );
}
