import { roleIdSchema, states } from '@pitchcrew/core';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IdRoute } from '../types.ts';
import { CrewService } from '../../service.ts';

export function registerBoardRoutes(app: FastifyInstance, service: CrewService) {
  app.post('/api/cards', (req, res) => res.status(201).send(service.createCard(req.body)));
  app.post<IdRoute>('/api/cards/:id/move', (req, res) =>
    res.send(
      service.moveCard(req.params.id, z.object({ state: z.enum(states) }).parse(req.body).state),
    ),
  );
  app.post<IdRoute>('/api/cards/:id/run', async (req, res) =>
    res
      .status(202)
      .send(
        await service.startRun(
          req.params.id,
          z.object({ roleId: roleIdSchema }).parse(req.body).roleId,
        ),
      ),
  );
  app.post<IdRoute>('/api/runs/:id/cancel', (req, res) => {
    service.cancelRun(req.params.id);
    res.send({ ok: true });
  });
  app.put('/api/profile', async (req, res) => {
    const body = z
      .object({ name: z.string().max(100), content: z.string().max(50000) })
      .parse(req.body);
    res.send(await service.saveProfile(body.name, body.content));
  });
  app.post('/api/examples', async (_req, res) => {
    await service.loadExamples();
    res.send({ ok: true });
  });
}
