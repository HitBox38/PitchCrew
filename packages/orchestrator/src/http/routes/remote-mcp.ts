import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { RemoteMcpAccess } from '../../remote-mcp/index.ts';

export const registerRemoteMcpRoutes = (app: FastifyInstance, access: RemoteMcpAccess) => {
  app.addHook('onSend', async (_req, res) => {
    res.header('Cache-Control', 'no-store');
  });
  app.get('/api/remote-mcp', () => access.info());
  app.post('/api/remote-mcp/start', (req) => {
    z.object({}).strict().parse(req.body);
    return access.start();
  });
  app.post('/api/remote-mcp/stop', (req) => {
    z.object({}).strict().parse(req.body);
    return access.stop();
  });
  app.post<{ Params: { id: string } }>('/api/remote-mcp/requests/:id/decision', (req) => {
    const id = z.uuid().parse(req.params.id);
    return access.decide(
      id,
      z.object({ approved: z.boolean(), write: z.boolean() }).strict().parse(req.body),
    );
  });
  app.delete<{ Params: { id: string } }>('/api/remote-mcp/clients/:id', (req) =>
    access.revoke(z.uuid().parse(req.params.id)),
  );
};
