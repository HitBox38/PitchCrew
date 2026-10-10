import type { FastifyInstance } from 'fastify';
import { createAppUpdateChecker, type AppUpdateOptions } from '../../app-updates/index.ts';

export function registerAppUpdateRoutes(app: FastifyInstance, options?: AppUpdateOptions) {
  const checker = createAppUpdateChecker(options);
  app.addHook('onClose', async () => checker.close());
  app.get('/api/app-updates', () => checker.info());
  app.post<{ Querystring: { manual?: string } }>('/api/app-updates/check', (request) =>
    checker.check(request.query.manual === 'true'),
  );
}
