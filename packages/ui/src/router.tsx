import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Link,
  notFound,
  redirect,
} from '@tanstack/react-router';
import type { RouterHistory } from '@tanstack/react-router';
import { isChatThread, validateSkillSearch } from './navigation.ts';
import type { View } from './navigation.ts';

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    view?: View;
  }
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}

const rootRoute = createRootRoute({
  component: lazyRouteComponent(() => import('./App.tsx'), 'App'),
  notFoundComponent: () => (
    <section className="empty-state">
      <h2>Page not found</h2>
      <p>This address doesn’t match a workspace page.</p>
      <Link to="/">Go to Board</Link>
    </section>
  ),
});

const boardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  staticData: { view: 'board' },
  component: lazyRouteComponent(() => import('./board-page.tsx'), 'BoardPage'),
});
const crewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/crew',
  staticData: { view: 'crew' },
  component: lazyRouteComponent(() => import('./crew-page.tsx'), 'CrewPage'),
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
  component: lazyRouteComponent(() => import('./workspace-pages.tsx'), 'ChatPage'),
});
const inboxRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/inbox',
  staticData: { view: 'inbox' },
  component: lazyRouteComponent(() => import('./workspace-pages.tsx'), 'InboxPage'),
});
const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  staticData: { view: 'profile' },
  component: lazyRouteComponent(() => import('./workspace-pages.tsx'), 'ProfilePage'),
});
const skillsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/skills',
  staticData: { view: 'skills' },
  validateSearch: validateSkillSearch,
  component: lazyRouteComponent(() => import('./workspace-pages.tsx'), 'SkillsPage'),
});
const activityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/activity',
  staticData: { view: 'activity' },
  component: lazyRouteComponent(() => import('./activity-page.tsx'), 'ActivityPage'),
});

const routeTree = rootRoute.addChildren([
  boardRoute,
  crewRoute,
  chatIndexRoute,
  chatRoute,
  inboxRoute,
  profileRoute,
  skillsRoute,
  activityRoute,
]);

// Both browser and Electron render from the daemon's HTTP origin.
// Tests provide memory history to exercise the same route tree without a DOM.
export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, history });
}
