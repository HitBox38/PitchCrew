import type { FastifyInstance } from 'fastify';
import { runtimeIds, type RuntimeConnectionUpdate } from '@pitchcrew/core';
import { z } from 'zod';
import type { CrewService } from '../../service.ts';
import type { IdRoute } from '../types.ts';
import { RuntimeConnectionConflict } from '../../runtime-connections/index.ts';

/** Write-only secrets: these endpoints are protected by the existing local user session. */
export const registerRuntimeConnectionRoutes = (app: FastifyInstance, service: CrewService) => {
  app.addHook('onSend', (_request, reply, payload, done) => {
    reply.header('cache-control', 'no-store');
    reply.header('referrer-policy', 'no-referrer');
    done(null, payload);
  });
  const runtime = (id: string) => z.enum(runtimeIds).parse(id);
  app.get<IdRoute>('/api/runtimes/:id/connection', (request) =>
    service.runtimeConnections.status(runtime(request.params.id)),
  );
  app.put<IdRoute>('/api/runtimes/:id/connection', async (request, reply) => {
    try {
      return await service.runtimeConnections.configure(
        runtime(request.params.id),
        request.body as RuntimeConnectionUpdate,
      );
    } catch (error) {
      if (error instanceof RuntimeConnectionConflict)
        return reply.code(409).send({
          error:
            'Authentication settings changed in another window. Your draft is kept; reload the saved settings before saving again.',
        });
      if (error instanceof z.ZodError)
        return reply.code(400).send({
          error: 'Use supported authentication variables with bounded, single-line values.',
        });
      throw error;
    }
  });
  app.post<IdRoute>('/api/runtimes/:id/connection/recover', async (request, reply) => {
    if (
      !z
        .object({ confirmed: z.literal(true) })
        .strict()
        .safeParse(request.body).success
    )
      return reply
        .code(400)
        .send({ error: 'Confirm recovery before resetting saved authentication settings.' });
    return service.runtimeConnections.recover(runtime(request.params.id));
  });
};
