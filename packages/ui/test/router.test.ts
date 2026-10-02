import { createMemoryHistory } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';
import { createAppRouter } from '../src/router.ts';

async function setup(path: string) {
  const history = createMemoryHistory({ initialEntries: [path] });
  const router = createAppRouter(history);
  router.update({ isServer: false, origin: 'http://127.0.0.1' });
  await router.load();
  return { router, history };
}

describe('workspace routes', () => {
  it.each([
    ['/', 'board'],
    ['/crew', 'crew'],
    ['/chat/writer', 'chat'],
    ['/chat/crew', 'chat'],
    ['/inbox', 'inbox'],
    ['/profile', 'profile'],
    ['/skills', 'skills'],
    ['/activity', 'activity'],
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

  it.each(['unknown', 'all'])('uses the default skill assignment for %s', async (filter) => {
    const { router } = await setup(`/skills?filter=${filter}`);
    expect(router.state.matches.at(-1)?.search).toMatchObject({ filter: undefined });
  });

  it.each(['/missing', '/chat/unknown'])('shows not found for %s', async (path) => {
    const { router } = await setup(path);
    expect(
      router.state.matches.some((match) => match.status === 'notFound' || match._notFound),
    ).toBe(true);
    expect(router.state.location.pathname).toBe(path);
  });
});
