import type { FastifyInstance } from 'fastify';
import type { CrewService } from '../../service.ts';

export const registerOnboardingRoutes = (app: FastifyInstance, service: CrewService) => {
  app.put('/api/onboarding', (req) => service.onboarding.save(req.body));
};
