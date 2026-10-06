import { roleIdSchema, runtimeIds } from '@pitchcrew/core';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IdRoute } from '../types.ts';
import { CrewService } from '../../service.ts';

export function registerCrewRoutes(app: FastifyInstance, service: CrewService) {
  app.post('/api/roles', async (req, res) =>
    res.status(201).send(await service.createRole(req.body)),
  );
  app.post<IdRoute>('/api/roles/:id/retire', async (req, res) =>
    res.send(await service.retireRole(roleIdSchema.parse(req.params.id))),
  );
  app.post<IdRoute>('/api/roles/:id/restore', async (req, res) =>
    res.send(await service.restoreRole(roleIdSchema.parse(req.params.id))),
  );
  app.put<IdRoute>('/api/roles/:id', async (req, res) =>
    res.send(await service.configureRole(roleIdSchema.parse(req.params.id), req.body)),
  );
  app.post<IdRoute>('/api/roles/:id/runtime-recommendation', async (req, res) =>
    res.send(await service.runtimeRecommendation(roleIdSchema.parse(req.params.id))),
  );
  // Default instruction updates are user decisions only; the agent gateway has no equivalent.
  app.post<IdRoute>('/api/roles/:id/instructions-update/adopt', async (req, res) =>
    res.send(await service.adoptDefaultInstructions(roleIdSchema.parse(req.params.id), req.body)),
  );
  app.post<IdRoute>('/api/roles/:id/instructions-update/dismiss', (req, res) =>
    res.send(service.dismissInstructionUpdate(roleIdSchema.parse(req.params.id), req.body)),
  );
  app.post<IdRoute>('/api/roles/:id/chat', async (req, res) =>
    res.status(202).send(await service.sendChat(roleIdSchema.parse(req.params.id), req.body)),
  );
  app.post<IdRoute>('/api/proposals/:id/decide', async (req, res) =>
    res.send(
      await service.decideProposal(
        req.params.id,
        z.object({ approved: z.boolean() }).parse(req.body).approved,
      ),
    ),
  );
  app.post<IdRoute>('/api/pipeline-reviews/:id/followup', (req, res) =>
    res.send(
      service.updatePipelineReview({
        ...z.record(z.string(), z.unknown()).parse(req.body),
        reviewId: req.params.id,
      }),
    ),
  );
  app.post('/api/runtimes/detect', async (_req, res) => res.send(await service.detect()));
  app.post<IdRoute>('/api/runtimes/:id/models', async (req, res) => {
    const { refresh } = z.object({ refresh: z.boolean().default(false) }).parse(req.body ?? {});
    res.send(await service.runtimeModels(z.enum(runtimeIds).parse(req.params.id), refresh));
  });
}
