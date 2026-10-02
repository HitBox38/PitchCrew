import express from 'express';
import { z } from 'zod';
import { CrewService } from '../../service.ts';

export function registerSkillsRoutes(app: express.Express, service: CrewService) {
  app.post('/api/skills', (req, res) => res.status(201).json(service.saveSkill(req.body)));
  app.post('/api/skills/starter/retry', async (_req, res) =>
    res.json(await service.seedStarterSkills()),
  );
  app.post('/api/skills/preview', async (req, res) => {
    const { url } = z.object({ url: z.string() }).parse(req.body);
    res.json(await service.previewSkill(url));
  });
  app.put('/api/skills/:id', (req, res) => res.json(service.saveSkill(req.body, req.params.id)));
  app.delete('/api/skills/:id', (req, res) => res.json(service.deleteSkill(req.params.id)));
  app.post('/api/skill-proposals/:id/decide', (req, res) =>
    res.json(
      service.decideSkillProposal(
        req.params.id,
        z.object({ approved: z.boolean() }).parse(req.body).approved,
      ),
    ),
  );
}
