import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { createTelemetryBuffer } from '../../telemetry/buffer.ts';

/** Inherits the daemon's Host, Origin and UI-session hooks; agent capabilities cannot read this route. */
export function registerTelemetryRoutes(
  app: FastifyInstance,
  buffer: ReturnType<typeof createTelemetryBuffer>,
) {
  app.get('/api/telemetry/observations', (request) => {
    const { after } = z
      .object({ after: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional() })
      .strict()
      .parse(request.query);
    return buffer.read(after);
  });
}
