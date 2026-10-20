import type { FastifyInstance } from 'fastify';
import { runtimeIds } from '@pitchcrew/core';
import { z } from 'zod';
import type { CrewService } from '../../service.ts';
import type { IdRoute } from '../types.ts';

/** Loopback user session only. Not exposed through the agent gateway. */
export function registerRuntimeMaintenanceRoutes(app: FastifyInstance, service: CrewService) {
  app.get('/api/runtimes/maintenance', () => service.runtimeMaintenance.current());
  app.post('/api/runtimes/updates/check', async (req) => {
    const { automatic } = z
      .object({ automatic: z.boolean().default(false) })
      .strict()
      .parse(req.body ?? {});
    return service.runtimeMaintenance.check(automatic);
  });
  app.put('/api/runtimes/updates/preferences', (req) =>
    service.runtimeMaintenance.configure(
      z.object({ automatic: z.boolean() }).strict().parse(req.body).automatic,
    ),
  );
  app.post<IdRoute>('/api/runtimes/:id/update', (req, res) => {
    z.object({})
      .strict()
      .parse(req.body ?? {});
    const id = z.enum(runtimeIds).parse(req.params.id);
    return res.code(202).send(service.runtimeMaintenance.startUpdate(id));
  });
  app.post<IdRoute>('/api/runtimes/:id/recheck', async (req) => {
    const id = z.enum(runtimeIds).parse(req.params.id);
    const { model } = z
      .object({ model: z.string().max(300).default('') })
      .strict()
      .parse(req.body ?? {});
    if (!service.runtimes.some((runtime) => runtime.id === id))
      throw new Error('This runtime is unavailable.');
    await service.detect();
    await service.runtimeMaintenance
      .guard({ runtime: id, model }, async () => {}, true)
      .catch((error: unknown) => {
        if (service.runtimeMaintenance.isUpdating(id)) throw error;
      });
    await service.runtimeMaintenance.initializeAuthentication(true);
    return service.runtimeMaintenance.current();
  });
}
