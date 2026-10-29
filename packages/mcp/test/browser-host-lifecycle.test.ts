import { afterEach, expect, it, vi } from 'vitest';
import { DesktopBrowserHosts } from '../src/computer/native-host.ts';

const launch = vi.hoisted(() => vi.fn(async () => ({ close: async () => {} })));
vi.mock('../src/computer/driver.ts', () => ({ launchBrowser: launch }));
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

it('allows a web-only daemon to launch its isolated headless browser', async () => {
  const hosts = new DesktopBrowserHosts();
  expect(await hosts.launch('/fictional/profile')).toBeTruthy();
  expect(launch).toHaveBeenCalledWith('/fictional/profile');
});

it('reports an expired desktop rather than silently opening a different agent page', async () => {
  vi.useFakeTimers();
  const hosts = new DesktopBrowserHosts();
  hosts.register({
    origin: 'http://127.0.0.1:4417',
    token: 'a'.repeat(64),
    ownerId: '524b6da0-c1b6-4434-bfc8-ae884c412c67',
  });
  await vi.advanceTimersByTimeAsync(15001);
  await expect(hosts.launch('/fictional/profile')).rejects.toThrow('disconnected');
  expect(launch).not.toHaveBeenCalled();
});
