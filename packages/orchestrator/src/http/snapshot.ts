import { z } from 'zod';
import type { Snapshot } from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { CrewService } from '../service.ts';

/** Conditional polling is private to the current daemon; ordinary callers still get a full snapshot. */
export const registerSnapshot = (
  app: FastifyInstance,
  service: Pick<CrewService, 'snapshot' | 'snapshotRevision'>,
) => {
  const instance = randomUUID();
  const inflight = new Map<string, Promise<Snapshot>>();
  app.get('/api/snapshot', async (request, reply) => {
    const workspace =
      z.object({ view: z.literal('workspace').optional() }).parse(request.query).view ===
      'workspace';
    const revision = await service.snapshotRevision();
    const etag = `W/"${instance}-${workspace ? 'workspace' : 'full'}-${revision}"`;
    reply.header('etag', etag).header('cache-control', 'private, no-store');
    if (request.headers['if-none-match'] === etag) return reply.code(304).send();
    // Label with the revision from before the asynchronous snapshot. Any intervening mutation
    // changes the next validator, so a racing response cannot suppress the next refresh.
    if (!workspace) return service.snapshot();
    const existing = inflight.get(etag);
    if (existing) return existing;
    const pending = service.snapshot({ workspace: true });
    inflight.set(etag, pending);
    try {
      return await pending;
    } finally {
      if (inflight.get(etag) === pending) inflight.delete(etag);
    }
  });
};
