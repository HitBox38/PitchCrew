import type express from 'express';
import { z } from 'zod';
import type { CrewService } from '../../service.ts';

export function registerRoutinesRoutes(app: express.Express, service: CrewService) {
  app.get('/api/routines', (_req, res) => res.json(service.routines()));
  app.post('/api/routines', (req, res) => res.status(201).json(service.saveRoutine(req.body)));
  app.put('/api/routines/:id', (req, res) =>
    res.json(service.saveRoutine(req.body, z.uuid().parse(req.params.id))),
  );
  app.delete('/api/routines/:id', (req, res) =>
    res.json(service.deleteRoutine(z.uuid().parse(req.params.id))),
  );
}
