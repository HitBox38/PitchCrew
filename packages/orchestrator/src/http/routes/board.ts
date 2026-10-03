import { roleIdSchema, states } from '@pitchcrew/core';
import express from 'express';
import { z } from 'zod';
import { CrewService } from '../../service.ts';

export function registerBoardRoutes(app: express.Express, service: CrewService) {
  app.post('/api/cards', (req, res) => res.status(201).json(service.createCard(req.body)));
  app.post('/api/cards/:id/move', (req, res) =>
    res.json(
      service.moveCard(req.params.id, z.object({ state: z.enum(states) }).parse(req.body).state),
    ),
  );
  app.post('/api/cards/:id/run', async (req, res) =>
    res
      .status(202)
      .json(
        await service.startRun(
          req.params.id,
          z.object({ roleId: roleIdSchema }).parse(req.body).roleId,
        ),
      ),
  );
  app.post('/api/runs/:id/cancel', (req, res) => {
    service.cancelRun(req.params.id);
    res.json({ ok: true });
  });
  app.put('/api/profile', async (req, res) => {
    const body = z
      .object({ name: z.string().max(100), content: z.string().max(50000) })
      .parse(req.body);
    res.json(await service.saveProfile(body.name, body.content));
  });
  app.post('/api/examples', async (_req, res) => {
    await service.loadExamples();
    res.json({ ok: true });
  });
}
