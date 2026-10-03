import {
  decideTrackingSignal,
  linkTrackingThread,
  unlinkTrackingThread,
  refreshTrackingSignal,
  registerExternalApplication,
  registerExistingExternalSubmission,
  searchApplications,
  updateTrackingIdentifier,
} from '@pitchcrew/board';
import express from 'express';
import { z } from 'zod';
import type { CrewService } from '../../service.ts';

export function registerTrackingRoutes(app: express.Express, service: CrewService) {
  app.post('/api/tracking/applications/:id/external', (req, res) =>
    res.json(registerExistingExternalSubmission(service.board, req.params.id, req.body)),
  );
  app.put('/api/tracking/applications/:id/identifier', (req, res) => {
    const input = z
      .object({ jobIdentifier: z.string().trim().max(200) })
      .strict()
      .parse(req.body);
    res.json(updateTrackingIdentifier(service.board, req.params.id, input.jobIdentifier));
  });
  app.post('/api/tracking/applications/search', (req, res) =>
    res.json(searchApplications(service.board, req.body)),
  );
  app.get('/api/tracking', (_req, res) =>
    res.json({
      evidence: service.board.list('tracking_signal'),
      scans: service.board.list('tracking_scan'),
    }),
  );
  app.post('/api/tracking/external', (req, res) =>
    res.status(201).json(registerExternalApplication(service.board, req.body)),
  );
  app.post('/api/tracking/evidence/:id/decision', (req, res) => {
    const input = z
      .object({
        approved: z.boolean(),
        cardId: z.uuid().optional(),
        cardUpdatedAt: z.string().optional(),
      })
      .strict()
      .parse(req.body);
    res.json(
      decideTrackingSignal(
        service.board,
        req.params.id,
        input.approved,
        input.cardId,
        input.cardUpdatedAt,
      ),
    );
  });
  app.post('/api/tracking/evidence/:id/refresh', (req, res) =>
    res.json(refreshTrackingSignal(service.board, req.params.id)),
  );
  app.delete('/api/tracking/applications/:id/thread', (req, res) => {
    const input = z
      .object({
        account: z.string().min(1).max(320),
        threadId: z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/),
      })
      .strict()
      .parse(req.body);
    res.json(unlinkTrackingThread(service.board, req.params.id, input.account, input.threadId));
  });
  app.post('/api/tracking/applications/:id/thread', (req, res) => {
    const input = z
      .object({ threadId: z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/) })
      .strict()
      .parse(req.body);
    const account = service.connectors
      .status()
      .find((value) => value.id === 'google' && value.connected)?.account;
    if (!account) throw new Error('Connect Gmail before linking a thread.');
    res.json(linkTrackingThread(service.board, req.params.id, account, input.threadId));
  });
}
