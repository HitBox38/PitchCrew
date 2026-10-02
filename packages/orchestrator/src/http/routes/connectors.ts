import express from 'express';
import { z } from 'zod';
import { CrewService } from '../../service.ts';

export function registerConnectorsRoutes(app: express.Express, service: CrewService) {
  app.post('/api/connectors/github/connect', async (req, res) =>
    res.json(await service.connectors.connectGithub(req.body)),
  );
  app.post('/api/connectors/google/connect', async (req, res) =>
    res.json(await service.connectors.connectGoogle(req.body)),
  );
  app.post('/api/connectors/:id/disconnect', async (req, res) =>
    res.json(
      await service.connectors.disconnect(z.enum(['github', 'google']).parse(req.params.id)),
    ),
  );
}
