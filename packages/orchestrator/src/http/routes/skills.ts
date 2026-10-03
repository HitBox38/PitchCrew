import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IdRoute } from '../types.ts';
import { CrewService } from '../../service.ts';

export function registerSkillsRoutes(app: FastifyInstance, service: CrewService) {
  app.post('/api/skills', (req, res) => res.status(201).send(service.saveSkill(req.body)));
  app.post('/api/skills/starter/retry', async (_req, res) =>
    res.send(await service.seedStarterSkills()),
  );
  app.post('/api/skills/preview', async (req, res) => {
    const { url } = z.object({ url: z.string() }).parse(req.body);
    res.send(await service.previewSkill(url));
  });
  app.put<IdRoute>('/api/skills/:id', (req, res) =>
    res.send(service.saveSkill(req.body, req.params.id)),
  );
  app.delete<IdRoute>('/api/skills/:id', (req, res) =>
    res.send(service.deleteSkill(req.params.id)),
  );
  app.post<IdRoute>('/api/skill-proposals/:id/decide', (req, res) =>
    res.send(
      service.decideSkillProposal(
        req.params.id,
        z.object({ approved: z.boolean() }).parse(req.body).approved,
      ),
    ),
  );
}
