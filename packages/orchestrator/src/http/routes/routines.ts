import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IdRoute } from '../types.ts';
import type { CrewService } from '../../service.ts';

export function registerRoutinesRoutes(app: FastifyInstance, service: CrewService) {
  app.get('/api/routines', (_req, res) => res.send(service.routines()));
  app.post('/api/routines', (req, res) => res.status(201).send(service.saveRoutine(req.body)));
  app.put<IdRoute>('/api/routines/:id', (req, res) =>
    res.send(service.saveRoutine(req.body, z.uuid().parse(req.params.id))),
  );
  app.delete<IdRoute>('/api/routines/:id', (req, res) =>
    res.send(service.deleteRoutine(z.uuid().parse(req.params.id))),
  );
}
