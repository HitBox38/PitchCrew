import { roleIdSchema, runtimeIds } from '@pitchcrew/core';
import express from 'express';
import { z } from 'zod';
import { CrewService } from '../../service.ts';

export function registerCrewRoutes(app: express.Express, service: CrewService) {
  app.post('/api/roles', async (req, res) =>
    res.status(201).json(await service.createRole(req.body)),
  );
  app.post('/api/roles/:id/retire', async (req, res) =>
    res.json(await service.retireRole(roleIdSchema.parse(req.params.id))),
  );
  app.put('/api/roles/:id', async (req, res) =>
    res.json(await service.configureRole(roleIdSchema.parse(req.params.id), req.body)),
  );
  app.post('/api/roles/:id/chat', async (req, res) =>
    res.status(202).json(await service.sendChat(roleIdSchema.parse(req.params.id), req.body)),
  );
  app.post('/api/proposals/:id/decide', async (req, res) =>
    res.json(
      await service.decideProposal(
        req.params.id,
        z.object({ approved: z.boolean() }).parse(req.body).approved,
      ),
    ),
  );
  app.post('/api/runtimes/detect', async (_req, res) => res.json(await service.detect()));
  app.post('/api/runtimes/:id/models', async (req, res) => {
    const { refresh } = z.object({ refresh: z.boolean().default(false) }).parse(req.body ?? {});
    res.json(await service.runtimeModels(z.enum(runtimeIds).parse(req.params.id), refresh));
  });
}
