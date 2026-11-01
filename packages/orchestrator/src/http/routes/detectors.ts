import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { detectorProviders } from '@pitchcrew/core';
import type { IdRoute } from '../types.ts';
import type { CrewService } from '../../service.ts';

const provider = z.enum(detectorProviders);

/** User-only detector checks and keys; the agent gateway has no equivalent action. */
export const registerDetectorRoutes = (app: FastifyInstance, service: CrewService) => {
  app.post('/api/detectors/check', (req) => service.detectors.check(req.body));
  app.put<IdRoute>('/api/detectors/:id/key', (req) =>
    service.detectors.saveKey(provider.parse(req.params.id), req.body),
  );
  app.delete<IdRoute>('/api/detectors/:id/key', (req) =>
    service.detectors.removeKey(provider.parse(req.params.id)),
  );
};
