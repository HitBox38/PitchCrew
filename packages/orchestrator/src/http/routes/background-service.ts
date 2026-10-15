import type { BackgroundServiceInfo } from '@pitchcrew/core';
import type { FastifyInstance } from 'fastify';
import { backgroundServiceInfo, readBackgroundService } from '../../background/info.ts';
import { installBackgroundService } from '../../background/install.ts';
import type { DaemonOptions } from '../../server.ts';

/** Session-protected service status and user-requested installation for this workspace. */
export function registerBackgroundServiceRoutes(app: FastifyInstance, options: DaemonOptions) {
  const settings = { directory: options.directory, port: options.port };
  const daemon = { ...settings, service: options.service ?? false };
  let installing: Promise<BackgroundServiceInfo> | null = null;
  app.get('/api/background-service', async (): Promise<BackgroundServiceInfo> =>
    backgroundServiceInfo(
      await (options.backgroundService?.() ?? readBackgroundService(settings)),
      daemon,
    ),
  );
  app.post('/api/background-service/install', async () => {
    if (!installing) {
      installing = Promise.resolve()
        .then(() => options.backgroundServiceInstall?.() ?? installBackgroundService(settings))
        .then((status) => backgroundServiceInfo(status, daemon))
        .finally(() => {
          installing = null;
        });
    }
    return installing;
  });
}
