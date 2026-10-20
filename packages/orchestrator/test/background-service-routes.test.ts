import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import { afterEach, expect, it, vi } from 'vitest';
import { unsupportedStatus } from '../src/background/info.ts';
import { createBackgroundService } from '../src/background/index.ts';
import { installServiceWithUi } from '../src/background/install.ts';
import { registerBackgroundServiceRoutes } from '../src/http/routes/background-service.ts';
import { registerSessionSecurity } from '../src/http/security.ts';
import { fakeServiceHost, fixtureSpecs } from './helpers/service-host.ts';

const setup = async (install: () => Promise<typeof unsupportedStatus>) => {
  const app = Fastify();
  apps.push(app);
  await app.register(cookie);
  registerSessionSecurity(app, { port: 4418 }, 'http://127.0.0.1:4418', new Set(['fixture']));
  app.setErrorHandler((error, _request, reply) =>
    reply.code(400).send({ error: (error as Error).message }),
  );
  registerBackgroundServiceRoutes(app, {
    directory: fixtureSpecs.linux.directory,
    port: 4418,
    backgroundService: async () => ({ ...unsupportedStatus, platform: 'linux' }),
    backgroundServiceInstall: install,
  });
  const headers = {
    host: '127.0.0.1:4418',
    cookie: 'pitchcrew_session=fixture',
    'x-pitchcrew-client': 'ui',
  };
  return { app, headers };
};

const apps: ReturnType<typeof Fastify>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

it('only installs on a POST from a local UI session and returns refreshed workspace state', async () => {
  const spec = fixtureSpecs.linux;
  const { host } = fakeServiceHost('linux', spec);
  const install = vi.fn(() => installServiceWithUi(createBackgroundService(spec, host), host));
  const { app, headers } = await setup(install);
  const url = '/api/background-service/install';
  for (const denied of [
    { ...headers, cookie: '' },
    { ...headers, 'x-pitchcrew-client': '' },
    { ...headers, origin: 'https://example.com' },
    { ...headers, host: 'example.com:4418' },
  ])
    expect((await app.inject({ method: 'POST', url, headers: denied })).statusCode).toBe(403);
  expect(
    (await app.inject({ method: 'GET', url: '/api/background-service', headers })).statusCode,
  ).toBe(200);
  expect(install).not.toHaveBeenCalled();
  const response = await app.inject({ method: 'POST', url, headers });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({
    matches: true,
    customLocation: true,
    status: { installed: true, directory: spec.directory, port: spec.port },
  });
  expect(install).toHaveBeenCalledOnce();
});

it('shares concurrent installs, surfaces failures and accepts a subsequent retry', async () => {
  let reject!: (error: Error) => void;
  const install = vi.fn(
    () =>
      new Promise<typeof unsupportedStatus>((_resolve, fail) => {
        reject = fail;
      }),
  );
  const { app, headers } = await setup(install);
  const request = { method: 'POST' as const, url: '/api/background-service/install', headers };
  const first = app.inject(request);
  const second = app.inject(request);
  await vi.waitFor(() => expect(install).toHaveBeenCalledOnce());
  reject(new Error('Service manager refused installation.'));
  for (const response of await Promise.all([first, second])) {
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'Service manager refused installation.' });
  }
  install.mockResolvedValue({ ...unsupportedStatus, platform: 'linux', installed: true });
  expect((await app.inject(request)).statusCode).toBe(200);
  expect(install).toHaveBeenCalledTimes(2);
});
