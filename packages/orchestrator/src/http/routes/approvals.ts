import express from 'express';
import { z } from 'zod';
import { CrewService } from '../../service.ts';

export function registerApprovalsRoutes(app: express.Express, service: CrewService) {
  app.post('/api/cards/:id/approval', (req, res) =>
    res.status(201).json(service.board.requestApproval(req.params.id)),
  );
  app.post('/api/approvals/:id/decide', (req, res) =>
    res.json(
      service.board.decideApproval(
        req.params.id,
        z.object({ approved: z.boolean() }).parse(req.body).approved,
      ),
    ),
  );
  app.post('/api/computer-approvals/:id/decide', (req, res) =>
    res.json(
      service.computer.decide(
        z.uuid().parse(req.params.id),
        z.object({ approved: z.boolean() }).parse(req.body).approved,
      ),
    ),
  );
  app.post('/api/approvals/:id/export', async (req, res) =>
    res.json({ directory: await service.exportPacket(req.params.id) }),
  );
}
