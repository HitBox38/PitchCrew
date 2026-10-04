import {
  addCardLesson,
  markStaleSubmissions,
  mergeTags,
  removeCardLesson,
  setCardWeight,
  staleSubmissions,
} from '@pitchcrew/board';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IdRoute } from '../types.ts';
import type { CrewService } from '../../service.ts';

// User-only learning signals. Session checks in http/security.ts guard every /api route;
// agents reach the daemon only through /api/agent, which has no matching action.
export function registerLearningRoutes(app: FastifyInstance, service: CrewService) {
  app.put<IdRoute>('/api/cards/:id/weight', (req, res) =>
    res.send(setCardWeight(service.board, req.params.id, req.body)),
  );
  app.post<IdRoute>('/api/cards/:id/lessons', (req, res) =>
    res.status(201).send(addCardLesson(service.board, req.params.id, req.body)),
  );
  app.delete<{ Params: { id: string; lessonId: string } }>(
    '/api/cards/:id/lessons/:lessonId',
    (req, res) =>
      res.send(removeCardLesson(service.board, req.params.id, z.uuid().parse(req.params.lessonId))),
  );
  app.post('/api/tags/merge', (req, res) => res.send(mergeTags(service.board, req.body)));
  app.get<{ Querystring: { days?: string } }>('/api/insights/stale', (req, res) =>
    res.send(staleSubmissions(service.board, req.query.days)),
  );
  app.post('/api/insights/stale', (req, res) =>
    res.send({ cards: markStaleSubmissions(service.board, req.body) }),
  );
}
