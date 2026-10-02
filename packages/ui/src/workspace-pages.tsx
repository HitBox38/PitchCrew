import { lazy } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { useWorkspace } from './workspace-context.tsx';
import { isChatThread } from './navigation.ts';

const views = () => import('./views.tsx');
const ProfileView = lazy(() => views().then((m) => ({ default: m.ProfileView })));
const InboxView = lazy(() => views().then((m) => ({ default: m.InboxView })));
const SkillsView = lazy(() => import('./skills-view.tsx').then((m) => ({ default: m.SkillsView })));
const ChatView = lazy(() => import('./chat-view.tsx').then((m) => ({ default: m.ChatView })));
const chatRoute = getRouteApi('/chat/$thread');
const skillsRoute = getRouteApi('/skills');

export function ChatPage() {
  const { data, action, working, openChat, setRoleId, openCard } = useWorkspace();
  const { thread } = chatRoute.useParams();
  if (!isChatThread(thread)) return null;
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
  const { data, action, working, openCard } = useWorkspace();
  return <InboxView data={data} action={action} working={working} onOpen={openCard} />;
}

export function ProfilePage() {
  const { data, action, working } = useWorkspace();
  return <ProfileView data={data} action={action} working={working} />;
}

export function SkillsPage() {
  const { data, action, working } = useWorkspace();
  const { filter = 'all' } = skillsRoute.useSearch();
  const navigate = skillsRoute.useNavigate();
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
