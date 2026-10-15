import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { CrewService } from '../service.ts';

/** Conditional polling is private to the current daemon; ordinary callers still get a full snapshot. */
export function registerSnapshot(
  app: FastifyInstance,
  service: Pick<CrewService, 'snapshot' | 'snapshotRevision'>,
) {
  const instance = randomUUID();
  app.get('/api/snapshot', async (request, reply) => {
    const revision = await service.snapshotRevision();
    const etag = `W/"${instance}-${revision}"`;
    reply.header('etag', etag).header('cache-control', 'private, no-store');
    if (request.headers['if-none-match'] === etag) return reply.code(304).send();
    // Label with the revision from before the asynchronous snapshot. Any intervening mutation
    // changes the next validator, so a racing response cannot suppress the next refresh.
    return service.snapshot();
  });
}
