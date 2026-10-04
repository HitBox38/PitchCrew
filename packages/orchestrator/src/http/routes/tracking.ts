import {
  applyApplicationImport,
  previewApplicationImport,
  decideTrackingSignal,
  linkTrackingThread,
  unlinkTrackingThread,
  refreshTrackingSignal,
  registerExternalApplication,
  registerExistingExternalSubmission,
  searchApplications,
  updateTrackingIdentifier,
} from '@pitchcrew/board';
import { importLimits } from '@pitchcrew/core';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IdRoute } from '../types.ts';
import type { CrewService } from '../../service.ts';

export function registerTrackingRoutes(app: FastifyInstance, service: CrewService) {
  app.post<IdRoute>('/api/tracking/applications/:id/external', (req, res) =>
    res.send(registerExistingExternalSubmission(service.board, req.params.id, req.body)),
  );
  app.put<IdRoute>('/api/tracking/applications/:id/identifier', (req, res) => {
    const input = z
      .object({ jobIdentifier: z.string().trim().max(200) })
      .strict()
      .parse(req.body);
    res.send(updateTrackingIdentifier(service.board, req.params.id, input.jobIdentifier));
  });
  app.post('/api/tracking/applications/search', (req, res) =>
    res.send(searchApplications(service.board, req.body)),
  );
  app.get('/api/tracking', (_req, res) =>
    res.send({
      evidence: service.board.list('tracking_signal'),
      scans: service.board.list('tracking_scan'),
    }),
  );
  app.post('/api/tracking/external', (req, res) =>
    res.status(201).send(registerExternalApplication(service.board, req.body)),
  );
  // User-only bulk import. JSON escaping can triple file bytes, so the body
  // limit is wider than the file limit that the board checks.
  const bodyLimit = importLimits.bytes * 3 + 4096;
  app.post('/api/tracking/import/preview', { bodyLimit }, (req, res) =>
    res.send(previewApplicationImport(service.board, req.body)),
  );
  app.post('/api/tracking/import/apply', { bodyLimit }, (req, res) =>
    res.send(applyApplicationImport(service.board, req.body)),
  );
  app.post<IdRoute>('/api/tracking/evidence/:id/decision', (req, res) => {
    const input = z
      .object({
        approved: z.boolean(),
        cardId: z.uuid().optional(),
        cardUpdatedAt: z.string().optional(),
      })
      .strict()
      .parse(req.body);
    res.send(
      decideTrackingSignal(
        service.board,
        req.params.id,
        input.approved,
        input.cardId,
        input.cardUpdatedAt,
      ),
    );
  });
  app.post<IdRoute>('/api/tracking/evidence/:id/refresh', (req, res) =>
    res.send(refreshTrackingSignal(service.board, req.params.id)),
  );
  app.delete<IdRoute>('/api/tracking/applications/:id/thread', (req, res) => {
    const input = z
      .object({
        account: z.string().min(1).max(320),
        threadId: z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/),
      })
      .strict()
      .parse(req.body);
    res.send(unlinkTrackingThread(service.board, req.params.id, input.account, input.threadId));
  });
  app.post<IdRoute>('/api/tracking/applications/:id/thread', (req, res) => {
    const input = z
      .object({ threadId: z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/) })
      .strict()
      .parse(req.body);
    const account = service.connectors
      .status()
      .find((value) => value.id === 'google' && value.connected)?.account;
    if (!account) throw new Error('Connect Gmail before linking a thread.');
    res.send(linkTrackingThread(service.board, req.params.id, account, input.threadId));
  });
}
