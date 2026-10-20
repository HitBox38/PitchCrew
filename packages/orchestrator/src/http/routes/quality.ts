import type { FastifyInstance } from 'fastify';
import type { CrewService } from '../../service.ts';
import type { WritingCorrection } from '@pitchcrew/core';
import { z } from 'zod';

export const registerQualityRoutes = (app: FastifyInstance, service: CrewService) => {
  app.post('/api/quality', (req) => service.qualityAction(req.body));
  app.get<{ Params: { id: string } }>('/api/quality/corrections/:id', (req) =>
    service.board.get<WritingCorrection>('writing_correction', z.uuid().parse(req.params.id)),
  );
};
