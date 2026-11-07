import type { FastifyInstance } from 'fastify';
import { runtimeIds } from '@pitchcrew/core';
import { z } from 'zod';
import type { CrewService } from '../../service.ts';
import type { IdRoute } from '../types.ts';

const runtimeId = (id: string) => {
  const value = z.enum(runtimeIds).parse(id);
  if (value === 'demo') throw new Error('Setup is available for real runtimes only.');
  return value;
};
const empty = z.object({}).strict();
const flow = z.object({ flowId: z.string().min(1).max(100) }).strict();
const response = z.discriminatedUnion('type', [
  z.object({ type: z.literal('browser'), action: z.enum(['open', 'decline']) }).strict(),
  z
    .object({
      type: z.literal('code'),
      code: z
        .string()
        .trim()
        .min(1)
        .max(2048)
        .regex(/^[^\r\n\0]+$/),
    })
    .strict(),
  z
    .object({
      type: z.literal('terminal'),
      data: z
        .string()
        .max(4096)
        .refine((value) => !value.includes('\0')),
      size: z
        .object({ cols: z.number().int().min(1).max(500), rows: z.number().int().min(1).max(200) })
        .strict()
        .optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('credentials'),
      values: z
        .record(
          z.string().min(1).max(100),
          z
            .string()
            .max(16_384)
            .regex(/^[^\r\n\0]*$/),
        )
        .refine((value) => Object.keys(value).length <= 16),
    })
    .strict(),
]);

/** User-session routes only. Auth URLs/codes and host paths never enter board snapshots. */
export const registerRuntimeSetupRoutes = (app: FastifyInstance, service: CrewService) => {
  app.addHook('onSend', (_request, reply, payload, done) => {
    reply.header('cache-control', 'no-store');
    reply.header('referrer-policy', 'no-referrer');
    done(null, payload);
  });
  app.get<IdRoute>('/api/runtimes/:id/setup', (req) =>
    service.runtimeSetup.info(runtimeId(req.params.id)),
  );
  app.put<IdRoute>('/api/runtimes/:id/setup', (req) => {
    const { executable } = z
      .object({ executable: z.string().trim().min(1).max(2048).nullable() })
      .strict()
      .parse(req.body);
    return service.runtimeSetup.configure(runtimeId(req.params.id), executable);
  });
  app.post<IdRoute>('/api/runtimes/:id/install', async (req, reply) => {
    empty.parse(req.body ?? {});
    return reply.code(202).send(await service.runtimeSetup.install(runtimeId(req.params.id)));
  });
  app.post<IdRoute>('/api/runtimes/:id/install/cancel', (req) => {
    const { operationId } = z
      .object({ operationId: z.string().min(1).max(100) })
      .strict()
      .parse(req.body);
    return service.runtimeSetup.cancel(runtimeId(req.params.id), operationId);
  });
  app.get<IdRoute>('/api/runtimes/:id/auth', (req) =>
    service.runtimeAuth.current(runtimeId(req.params.id)),
  );
  app.get<IdRoute>('/api/runtimes/:id/auth/methods', (req) =>
    service.runtimeAuth.discoverMethods(runtimeId(req.params.id)),
  );
  app.post<IdRoute>('/api/runtimes/:id/auth/start', (req, reply) => {
    const { methodId } = z
      .object({ methodId: z.string().min(1).max(100).optional() })
      .strict()
      .parse(req.body ?? {});
    return reply.code(202).send(service.runtimeAuth.start(runtimeId(req.params.id), methodId));
  });
  app.post<IdRoute>('/api/runtimes/:id/auth/logout', (req, reply) => {
    empty.parse(req.body ?? {});
    return reply.code(202).send(service.runtimeAuth.logout(runtimeId(req.params.id)));
  });
  app.post<IdRoute>('/api/runtimes/:id/auth/cancel', (req) => {
    const { flowId } = flow.parse(req.body);
    return service.runtimeAuth.cancel(runtimeId(req.params.id), flowId);
  });
  app.post<IdRoute>('/api/runtimes/:id/auth/respond', (req) => {
    const interactive = flow
      .extend({ interactionId: z.string().min(1).max(100), response })
      .strict()
      .safeParse(req.body);
    if (interactive.success)
      return service.runtimeAuth.respondInteraction(
        runtimeId(req.params.id),
        interactive.data.flowId,
        interactive.data.interactionId,
        interactive.data.response,
      );
    const { flowId, code } = flow
      .extend({
        code: z
          .string()
          .trim()
          .min(1)
          .max(2048)
          .regex(/^[^\r\n\0]+$/),
      })
      .parse(req.body);
    return service.runtimeAuth.respond(runtimeId(req.params.id), flowId, code);
  });
};
