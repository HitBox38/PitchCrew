import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IdRoute } from '../types.ts';
import type { CrewService } from '../../service.ts';

export function registerProfileSourcesRoutes(app: FastifyInstance, service: CrewService) {
  app.get('/api/profile/sources', async (_req, res) =>
    res.send(await service.profileSources.list()),
  );
  app.post('/api/profile/sources/project', async (req, res) =>
    res.send(await service.watchProfileProject(req.body)),
  );
  app.put<IdRoute>('/api/profile/sources/:id/watch', async (req, res) =>
    res.send(
      await service.setProfileSourceWatching(
        req.params.id,
        z.object({ watching: z.boolean() }).strict().parse(req.body).watching,
      ),
    ),
  );
  app.post<IdRoute>('/api/profile/proposals/:id/decide', async (req, res) =>
    res.send(await service.decideProfileProposal(z.uuid().parse(req.params.id), req.body)),
  );
  app.post('/api/profile/sources/preview', async (req, res) =>
    res.send(await service.profileSources.preview(req.body)),
  );
  app.post('/api/profile/sources/import', async (req, res) =>
    res.send(await service.importProfileSource(req.body)),
  );
  app.delete<IdRoute>('/api/profile/sources/:id', async (req, res) => {
    await service.unlinkProfileSource(
      z
        .string()
        .regex(/^[a-f0-9]{24}$/)
        .parse(req.params.id),
    );
    res.send({ ok: true });
  });
}
