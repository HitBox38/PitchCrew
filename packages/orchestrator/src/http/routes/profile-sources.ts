import express from 'express';
import { z } from 'zod';
import type { CrewService } from '../../service.ts';

export function registerProfileSourcesRoutes(app: express.Express, service: CrewService) {
  app.get('/api/profile/sources', async (_req, res) =>
    res.json(await service.profileSources.list()),
  );
  app.post('/api/profile/sources/project', async (req, res) =>
    res.json(await service.watchProfileProject(req.body)),
  );
  app.put('/api/profile/sources/:id/watch', async (req, res) =>
    res.json(
      await service.setProfileSourceWatching(
        req.params.id,
        z.object({ watching: z.boolean() }).strict().parse(req.body).watching,
      ),
    ),
  );
  app.post('/api/profile/proposals/:id/decide', async (req, res) =>
    res.json(await service.decideProfileProposal(z.uuid().parse(req.params.id), req.body)),
  );
  app.post('/api/profile/sources/preview', async (req, res) =>
    res.json(await service.profileSources.preview(req.body)),
  );
  app.post('/api/profile/sources/import', async (req, res) =>
    res.json(await service.importProfileSource(req.body)),
  );
  app.delete('/api/profile/sources/:id', async (req, res) => {
    await service.unlinkProfileSource(
      z
        .string()
        .regex(/^[a-f0-9]{24}$/)
        .parse(req.params.id),
    );
    res.json({ ok: true });
  });
}
