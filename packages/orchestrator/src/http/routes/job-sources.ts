import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IdRoute } from '../types.ts';
import type { CrewService } from '../../service.ts';

/** User-only source management. The session hook rejects agent and cross-origin callers. */
export function registerJobSourcesRoutes(app: FastifyInstance, service: CrewService) {
  const sourceId = (value: string) => z.uuid().parse(value);
  app.get('/api/job-sources', async (_req, res) => res.send(await service.jobSources.list()));
  app.post('/api/job-sources', async (req, res) =>
    res.status(201).send(await service.jobSources.add(req.body)),
  );
  app.put<IdRoute>('/api/job-sources/:id', async (req, res) =>
    res.send(await service.jobSources.update(sourceId(req.params.id), req.body)),
  );
  app.delete<IdRoute>('/api/job-sources/:id', async (req, res) => {
    await service.jobSources.remove(sourceId(req.params.id));
    res.send({ ok: true });
  });
  app.post('/api/job-sources/preview', async (req, res) => {
    const controller = new AbortController();
    // Stop reading the board when the user closes the page before the preview returns.
    res.raw.once('close', () => {
      if (!res.raw.writableFinished) controller.abort();
    });
    res.send(await service.jobSources.preview(req.body, controller.signal));
  });
  app.post('/api/job-sources/scan', async (req, res) =>
    res.send(await service.scanJobSources(req.body ?? {})),
  );
}
