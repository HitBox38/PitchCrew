import { registerDeepReviewRoutes } from './deep-reviews.ts';
import { registerCardChangeRoutes } from './card-changes.ts';
import { roleIdSchema, states } from '@pitchcrew/core';
import { deleteJob, editJob, setCardStatus } from '@pitchcrew/board';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IdRoute } from '../types.ts';
import { CrewService } from '../../service.ts';
import type { Card, Run } from '@pitchcrew/core';
import { registerApplicationContextRoutes } from './application-context.ts';
import { ProfileConflictError } from '../../profile-notes/index.ts';

export const registerBoardRoutes = (app: FastifyInstance, service: CrewService) => {
  registerApplicationContextRoutes(app, service);
  registerDeepReviewRoutes(app, service);
  registerCardChangeRoutes(app, service);
  app.get<IdRoute>('/api/cards/:id', (req) =>
    service.board.get<Card>('card', z.uuid().parse(req.params.id)),
  );
  // Job details reads its own history, since workspace snapshots carry only recent events.
  app.get<IdRoute>('/api/cards/:id/history', (req) => {
    const id = z.uuid().parse(req.params.id);
    service.board.get<Card>('card', id);
    return service.board
      .history(id, undefined, 200)
      .map(({ id: eventId, kind, actor, message, createdAt }) => ({
        id: eventId,
        kind,
        actor,
        message,
        createdAt,
      }));
  });
  app.post('/api/cards', (req, res) => res.status(201).send(service.createCard(req.body)));
  app.put<IdRoute>('/api/cards/:id', (req) =>
    editJob(service.board, z.uuid().parse(req.params.id), req.body),
  );
  app.delete<IdRoute>('/api/cards/:id', (req) => {
    const card = service.board.get<Card>('card', req.params.id);
    if (
      card.owner ||
      service.board
        .list<Run>('run')
        .some((run) => run.cardId === card.id && run.status === 'running')
    )
      throw new Error('Wait for the active run or cancel it before deleting this job.');
    deleteJob(service.board, req.params.id, 'user', 'User deleted the job');
    return { ok: true };
  });
  app.post<IdRoute>('/api/cards/:id/status', (req, res) =>
    res.send(
      setCardStatus(
        service.board,
        req.params.id,
        z.object({ state: z.enum(states) }).parse(req.body).state,
      ),
    ),
  );
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
      .object({
        name: z.string().max(100),
        content: z.string().max(50000),
        baseline: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .nullable()
          .optional(),
      })
      .parse(req.body);
    try {
      res.send(await service.saveProfile(body.name, body.content, body.baseline));
    } catch (error) {
      if (!(error instanceof ProfileConflictError)) throw error;
      res.status(409).send({ error: error.message, current: error.current });
    }
  });
  app.post('/api/profile/rename', async (req, res) =>
    res.send(await service.renameProfileNote(req.body)),
  );
  app.get('/api/profile/trash', async (_req, res) => res.send(await service.listProfileTrash()));
  app.post('/api/profile/restore', async (req, res) =>
    res.send(await service.restoreProfileNote(req.body)),
  );
  app.delete<{ Params: { name: string } }>('/api/profile/:name', async (req, res) =>
    res.send(await service.deleteProfileNote(req.params.name)),
  );
  app.post('/api/examples', async (_req, res) => {
    await service.loadExamples();
    res.send({ ok: true });
  });
};
