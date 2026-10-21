import { adapters } from '@pitchcrew/adapters';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { runtimeMaintenanceHost } from '../src/runtime-maintenance/index.ts';
import { createDaemon } from '../src/server.ts';

it('serves the workspace while authentication is pending, but never launches work before its guard', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-test-startup-auth-'));
  let finish!: (value: Awaited<ReturnType<typeof runtimeMaintenanceHost.authenticate>>) => void;
  const pending = new Promise<Awaited<ReturnType<typeof runtimeMaintenanceHost.authenticate>>>(
    (resolve) => {
      finish = resolve;
    },
  );
  for (const adapter of Object.values(adapters))
    vi.spyOn(adapter, 'detect').mockResolvedValue({
      id: adapter.id,
      available: adapter.id === 'codex',
      version: '1',
      detail: 'Fixture',
    });
  const auth = vi.spyOn(runtimeMaintenanceHost, 'authenticate').mockReturnValue(pending);
  let daemon: Awaited<ReturnType<typeof createDaemon>> | undefined;
  const creation = createDaemon({
    directory,
    port: 15014,
    seedSkills: false,
    dev: true,
    runtimeAuthenticationChecks: true,
  });
  try {
    daemon = await Promise.race([
      creation,
      new Promise<never>((_, reject) => {
        const timer = setTimeout(
          () => reject(new Error('Authentication blocked workspace readiness')),
          10000,
        );
        timer.unref();
      }),
    ]);
    await new Promise<void>((resolve) => daemon!.http.listen(0, '127.0.0.1', resolve));
    await vi.waitFor(() => expect(auth).toHaveBeenCalled());
    expect(
      (await daemon.app.inject({ url: '/api/health', headers: { host: '127.0.0.1:15014' } }))
        .statusCode,
    ).toBe(200);
    const action = vi.fn(async () => 'launched');
    const guarded = daemon.service.runtimeMaintenance.guard(
      { runtime: 'codex', model: '' },
      action,
    );
    expect(action).not.toHaveBeenCalled();
    finish({
      status: 'missing',
      checkedAt: new Date().toISOString(),
      detail: 'Fixture missing account.',
      instructions: 'Fixture setup.',
    });
    await expect(guarded).rejects.toThrow('Fixture missing account');
    expect(action).not.toHaveBeenCalled();
  } finally {
    finish({
      status: 'unknown',
      checkedAt: new Date().toISOString(),
      detail: 'Fixture',
      instructions: '',
    });
    await (daemon ?? (await creation)).close();
    vi.restoreAllMocks();
    await rm(directory, { recursive: true, force: true });
  }
});
