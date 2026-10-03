import express from 'express';
import { z } from 'zod';
import type { CrewService } from '../../service.ts';

export function registerProfileSourcesRoutes(app: express.Express, service: CrewService) {
  app.get('/api/profile/sources', async (_req, res) =>
    res.json(await service.profileSources.list()),
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
