import type { BackgroundServiceInfo } from '@pitchcrew/core';
import type { FastifyInstance } from 'fastify';
import { backgroundServiceInfo, readBackgroundService } from '../../background/info.ts';
import type { DaemonOptions } from '../../server.ts';

/** Read-only status for Settings; installing stays a CLI action the user runs. */
export function registerBackgroundServiceRoutes(app: FastifyInstance, options: DaemonOptions) {
  const settings = { directory: options.directory, port: options.port };
  app.get('/api/background-service', async (): Promise<BackgroundServiceInfo> =>
    backgroundServiceInfo(
      await (options.backgroundService?.() ?? readBackgroundService(settings)),
      { ...settings, service: options.service ?? false },
    ),
  );
}
