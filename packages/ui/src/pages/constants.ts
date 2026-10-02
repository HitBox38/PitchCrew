import { getRouteApi } from '@tanstack/react-router';
import { lazy } from 'react';

export const ProfileView = lazy(() =>
  import('@/components/ProfileView/index.tsx').then((m) => ({ default: m.ProfileView })),
);

export const InboxView = lazy(() =>
  import('@/components/InboxView/index.tsx').then((m) => ({ default: m.InboxView })),
);

export const SkillsView = lazy(() =>
  import('@/SkillsView/index.tsx').then((m) => ({ default: m.SkillsView })),
);

export const ChatView = lazy(() =>
  import('@/ChatView/index.tsx').then((m) => ({ default: m.ChatView })),
);

export const chatRoute = getRouteApi('/chat/$thread');

export const skillsRoute = getRouteApi('/skills');
