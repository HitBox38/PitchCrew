import type { Role } from '@pitchcrew/core';
import { createMemoryHistory } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';
import { createAppRouter } from '../src/router.ts';

async function setup(path: string) {
  const history = createMemoryHistory({ initialEntries: [path] });
  const router = createAppRouter(history);
  router.update({ isServer: false, origin: 'http://127.0.0.1', context: router.options.context });
  await router.load();
  return { router, history };
}

describe('workspace routes', () => {
  it('accepts custom role deep links and validates loaded stored roles', async () => {
    const history = createMemoryHistory({ initialEntries: ['/chat/research-assistant'] });
    const roles = [
      { id: 'scout', enabled: false, retiredAt: '2030-01-01' },
      { id: 'research-assistant', enabled: true },
    ] as Role[];
    const router = createAppRouter(history, () => roles);
    router.update({ isServer: false, origin: 'http://127.0.0.1', context: router.options.context });
    await router.load();
    expect(router.state.matches.at(-1)?.status).toBe('success');
    await router.navigate({ to: '/chat' });
    await router.load();
    expect(router.state.location.pathname).toBe('/chat/research-assistant');
    await router.navigate({ to: '/chat/$thread', params: { thread: 'missing' } });
    await router.load();
    expect(
      router.state.matches.some((match) => match.status === 'notFound' || match._notFound),
    ).toBe(true);
  });

  it.each([
    ['/', 'board'],
    ['/crew', 'crew'],
    ['/chat/writer', 'chat'],
    ['/chat/crew', 'chat'],
    ['/inbox', 'inbox'],
    ['/profile', 'profile'],
    ['/skills', 'skills'],
    ['/routines', 'routines'],
    ['/activity', 'activity'],
    ['/settings', 'settings'],
  ])('loads %s directly', async (path, view) => {
    const { router } = await setup(path);
    expect(router.state.matches.at(-1)?.staticData.view).toBe(view);
    expect(router.state.matches.every((match) => match.status === 'success')).toBe(true);
  });

  it('redirects the chat entry to Scout with history replacement', async () => {
    const { router } = await setup('/chat');
    expect(router.state.location.pathname).toBe('/chat/scout');
    expect(router.history.length).toBe(1);
  });

  it('restores the page and skill assignment through back and forward', async () => {
    const { router, history } = await setup('/chat/reviewer');
    await router.navigate({ to: '/skills', search: { filter: 'writer' } });
    await router.load();
    expect(router.state.location.search).toEqual({ filter: 'writer' });
    history.back();
    await router.load();
    expect(router.state.location.pathname).toBe('/chat/reviewer');
    expect(router.state.matches.at(-1)?.params).toMatchObject({ thread: 'reviewer' });
    history.forward();
    await router.load();
    expect(router.state.location.pathname).toBe('/skills');
    expect(router.state.matches.at(-1)?.search).toEqual({ filter: 'writer' });
  });

  it.each(['writer', 'scout', 'reviewer', 'shared'])(
    'accepts the %s skill filter in a deep link',
    async (filter) => {
      const { router } = await setup(`/skills?filter=${filter}`);
      expect(router.state.matches.at(-1)?.search).toEqual({ filter });
    },
  );

  it.each(['INVALID', 'all'])('uses the default skill assignment for %s', async (filter) => {
    const { router } = await setup(`/skills?filter=${filter}`);
    expect(router.state.matches.at(-1)?.search).toMatchObject({ filter: undefined });
  });

  it.each(['/missing', '/chat/INVALID'])('shows not found for %s', async (path) => {
    const { router } = await setup(path);
    expect(
      router.state.matches.some((match) => match.status === 'notFound' || match._notFound),
    ).toBe(true);
    expect(router.state.location.pathname).toBe(path);
  });

  it('restores activity filters from a deep link', async () => {
    const { router } = await setup('/activity?q=Writer&kind=run');
    expect(router.state.matches.at(-1)?.search).toEqual({ q: 'Writer', kind: 'run' });
  });

  it.each(['accounts', 'runtimes', 'rules', 'data'])(
    'opens the %s settings section from a deep link',
    async (section) => {
      const { router } = await setup(`/settings?section=${section}`);
      expect(router.state.matches.at(-1)?.search).toEqual({ section });
    },
  );

  it.each(['unknown', '__proto__', 'toString'])(
    'falls back to general settings for %s',
    async (section) => {
      const { router } = await setup(`/settings?section=${section}`);
      expect(router.state.matches.at(-1)?.search).toEqual({ section: 'general' });
    },
  );

  it('restores settings sections through browser history', async () => {
    const { router, history } = await setup('/settings?section=accounts');
    await router.navigate({ to: '/settings', search: { section: 'runtimes' } });
    await router.load();
    history.back();
    await router.load();
    expect(router.state.matches.at(-1)?.search).toEqual({ section: 'accounts' });
    history.forward();
    await router.load();
    expect(router.state.matches.at(-1)?.search).toEqual({ section: 'runtimes' });
  });

  it.each(['unknown', '__proto__', 'toString'])(
    'ignores invalid activity kind %s',
    async (kind) => {
      const { router } = await setup(`/activity?kind=${kind}`);
      expect(router.state.matches.at(-1)?.search).toMatchObject({ kind: undefined });
    },
  );
});
