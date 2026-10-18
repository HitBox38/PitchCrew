import { isChatThread } from '@/navigation.ts';
import { chatRoute } from '@/pages/constants.ts';
import { ChatView } from '@/ChatView/index.tsx';
import { useWorkspaceNavigation } from '@/workspace-navigation.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/components/ui/button/components/Button.tsx';

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
  if (
    data.conversations
      ? !data.conversations.some((conversation) => conversation.id === thread)
      : !data.roles.some((role) => role.id === thread) && thread !== 'crew'
  )
    return (
      <div className="grid gap-3 p-6">
        <p>This conversation does not exist.</p>
        <Button
          className="justify-self-start"
          onClick={() => {
            if (data.roles.some((role) => role.id === thread)) void openChat(thread);
            else useWorkspaceStore.getState().setCreatingConversation(true);
          }}
        >
          New conversation
        </Button>
      </div>
    );
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
