import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IdRoute } from '../types.ts';
import { CrewService } from '../../service.ts';

export function registerConnectorsRoutes(app: FastifyInstance, service: CrewService) {
  app.post('/api/connectors/github/connect', async (req, res) =>
    res.send(await service.connectors.connectGithub(req.body)),
  );
  app.post('/api/connectors/google/connect', async (req, res) =>
    res.send(
      z
        .object({ mode: z.literal('cli') })
        .strict()
        .safeParse(req.body).success
        ? await service.connectors.connectGoogleCli()
        : await service.connectors.connectGoogle(req.body),
    ),
  );
  app.post<IdRoute>('/api/connectors/:id/disconnect', async (req, res) =>
    res.send(
      await service.connectors.disconnect(z.enum(['github', 'google']).parse(req.params.id)),
    ),
  );
}
