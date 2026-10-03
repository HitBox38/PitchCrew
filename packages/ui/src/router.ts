import type { RouterHistory } from '@tanstack/react-router';
import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  notFound,
  redirect,
} from '@tanstack/react-router';
import { validateActivitySearch } from './ActivityPage/helpers.ts';
import { NotFoundPage } from './components/NotFoundPage/index.tsx';
import type { View } from './navigation.ts';
import { isChatThread, validateSkillSearch } from './navigation.ts';

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    view?: View;
  }
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}

const rootRoute = createRootRoute({
  component: lazyRouteComponent(() => import('@/App/index.tsx'), 'App'),
  notFoundComponent: NotFoundPage,
});

const boardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  staticData: { view: 'board' },
  component: lazyRouteComponent(() => import('@/BoardPage/index.tsx'), 'BoardPage'),
});
const crewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/crew',
  staticData: { view: 'crew' },
  component: lazyRouteComponent(() => import('@/CrewPage/index.tsx'), 'CrewPage'),
});
const chatIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/chat',
  beforeLoad: () => {
    throw redirect({ to: '/chat/$thread', params: { thread: 'scout' }, replace: true });
  },
});
const chatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/chat/$thread',
  staticData: { view: 'chat' },
  beforeLoad: ({ params }) => {
    if (!isChatThread(params.thread)) throw notFound();
  },
  component: lazyRouteComponent(() => import('@/pages/components/ChatPage.tsx'), 'ChatPage'),
});
const inboxRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/inbox',
  staticData: { view: 'inbox' },
  component: lazyRouteComponent(() => import('@/pages/components/InboxPage.tsx'), 'InboxPage'),
});
const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  staticData: { view: 'profile' },
  component: lazyRouteComponent(() => import('@/pages/components/ProfilePage.tsx'), 'ProfilePage'),
});
const skillsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/skills',
  staticData: { view: 'skills' },
  validateSearch: validateSkillSearch,
  component: lazyRouteComponent(() => import('@/pages/components/SkillsPage.tsx'), 'SkillsPage'),
});
const activityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/activity',
  staticData: { view: 'activity' },
  validateSearch: validateActivitySearch,
  component: lazyRouteComponent(() => import('@/ActivityPage/index.tsx'), 'ActivityPage'),
});
const routinesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/routines',
  staticData: { view: 'routines' },
  component: lazyRouteComponent(() => import('@/RoutinesPage/index.tsx'), 'RoutinesPage'),
});

const routeTree = rootRoute.addChildren([
  boardRoute,
  crewRoute,
  chatIndexRoute,
  chatRoute,
  inboxRoute,
  profileRoute,
  skillsRoute,
  routinesRoute,
  activityRoute,
]);

// Both browser and Electron render from the daemon's HTTP origin.
// Tests provide memory history to exercise the same route tree without a DOM.
export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, history });
}
