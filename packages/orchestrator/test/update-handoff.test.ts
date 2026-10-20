import { expect, it, vi } from 'vitest';
import {
  createUpdateHandoff,
  type UpdateHandoffDependencies,
} from '../src/background/update-handoff.ts';

const fixture = (overrides: Partial<UpdateHandoffDependencies> = {}) => {
  let running = true;
  const deps: UpdateHandoffDependencies = {
    plan: { action: 'spawn' },
    matchesService: vi.fn(async () => true),
    stopService: vi.fn(async () => {
      running = false;
    }),
    startService: vi.fn(async () => {
      running = true;
    }),
    stopOwned: vi.fn(async () => {
      running = false;
    }),
    startOwned: vi.fn(async () => {
      running = true;
    }),
    answers: vi.fn(async () => running),
    sleep: vi.fn(async () => {}),
    ...overrides,
  };
  return { deps, handoff: createUpdateHandoff(deps) };
};

it('stops an owned daemon, waits for shutdown, and can recover the previous runtime', async () => {
  const { deps, handoff } = fixture();
  await handoff.prepare();
  await handoff.recover();
  expect(deps.stopOwned).toHaveBeenCalledTimes(1);
  expect(deps.startOwned).toHaveBeenCalledTimes(1);
  expect(deps.stopService).not.toHaveBeenCalled();
});

it('stops and restores a matching service through its manager', async () => {
  const { deps, handoff } = fixture({ plan: { action: 'reuse', owner: 'service' } });
  await handoff.prepare();
  await handoff.recover();
  expect(deps.stopService).toHaveBeenCalledTimes(1);
  expect(deps.startService).toHaveBeenCalledTimes(1);
  expect(deps.stopOwned).not.toHaveBeenCalled();
});

it.each([
  { action: 'reuse', owner: 'other' },
  { action: 'reuse', owner: 'service' },
] as const)(
  'refuses to stop external daemons or services from another runtime (%j)',
  async (plan) => {
    const { deps, handoff } = fixture({ plan, matchesService: vi.fn(async () => false) });
    expect(await handoff.available()).toBe(false);
    await expect(handoff.prepare()).rejects.toThrow('separately running');
    await handoff.recover();
    expect(deps.stopOwned).not.toHaveBeenCalled();
    expect(deps.stopService).not.toHaveBeenCalled();
    expect(deps.startOwned).not.toHaveBeenCalled();
    expect(deps.startService).not.toHaveBeenCalled();
  },
);

it('rechecks service ownership at installation time', async () => {
  const matchesService = vi.fn(async () => true);
  const { handoff, deps } = fixture({ plan: { action: 'start-service' }, matchesService });
  expect(await handoff.available()).toBe(true);
  matchesService.mockResolvedValue(false);
  await expect(handoff.prepare()).rejects.toThrow('separately running');
  expect(deps.stopService).not.toHaveBeenCalled();
});

it('fails closed when a daemon still answers after the shutdown deadline', async () => {
  const { handoff, deps } = fixture({ answers: vi.fn(async () => true) });
  await expect(handoff.prepare()).rejects.toThrow('did not stop');
  expect(deps.sleep).toHaveBeenCalledTimes(120);
  await handoff.recover();
  expect(deps.startOwned).toHaveBeenCalledTimes(1);
});

it('does not stop an owned daemon while a service from another checkout could restart behind it', async () => {
  const { handoff, deps } = fixture({ externalService: async () => true });
  expect(await handoff.available()).toBe(false);
  await expect(handoff.prepare()).rejects.toThrow('separately running');
  expect(deps.stopOwned).not.toHaveBeenCalled();
});
