import { lazy } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore } from './workspace-store.ts';
import { useWorkspaceNavigation } from './workspace-navigation.ts';
import { isChatThread } from './navigation.ts';

const views = () => import('./views.tsx');
const ProfileView = lazy(() => views().then((m) => ({ default: m.ProfileView })));
const InboxView = lazy(() => views().then((m) => ({ default: m.InboxView })));
const SkillsView = lazy(() => import('./skills-view.tsx').then((m) => ({ default: m.SkillsView })));
const ChatView = lazy(() => import('./chat-view.tsx').then((m) => ({ default: m.ChatView })));
const chatRoute = getRouteApi('/chat/$thread');
const skillsRoute = getRouteApi('/skills');

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

export function InboxPage() {
  const { data, action, working, openCard } = useWorkspaceStore(
    useShallow((state) => ({
      data: state.data,
      action: state.action,
      working: state.working,
      openCard: state.openCard,
    })),
  );
  if (!data) return null;
  return <InboxView data={data} action={action} working={working} onOpen={openCard} />;
}

export function ProfilePage() {
  const { data, action, working } = useWorkspaceStore(
    useShallow((state) => ({
      data: state.data,
      action: state.action,
      working: state.working,
    })),
  );
  if (!data) return null;
  return <ProfileView data={data} action={action} working={working} />;
}

export function SkillsPage() {
  const { data, action, working } = useWorkspaceStore(
    useShallow((state) => ({
      data: state.data,
      action: state.action,
      working: state.working,
    })),
  );
  const { filter = 'all' } = skillsRoute.useSearch();
  const navigate = skillsRoute.useNavigate();
  if (!data) return null;
  return (
    <SkillsView
      data={data}
      action={action}
      working={working}
      filter={filter}
      onFilter={(next) => {
        void navigate({ search: next === 'all' ? {} : { filter: next } });
      }}
    />
  );
}
