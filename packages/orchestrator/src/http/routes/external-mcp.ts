import type { FastifyInstance } from 'fastify';
import {
  authorizeExternalAccess,
  enableExternalAccess,
  disableExternalAccess,
} from '@pitchcrew/mcp/external/access';
import { externalTools } from '@pitchcrew/mcp/external/tools';
import { externalRequest } from '../../external/gateway.ts';
import type { CrewService } from '../../service.ts';
import { z } from 'zod';
import { externalMcpInfo } from '../../external/configuration.ts';

export const registerExternalMcpRoutes = (app: FastifyInstance, service: CrewService) => {
  const settings = { directory: service.directory, port: Number(new URL(service.daemonUrl).port) };
  // These management routes retain the root user-session guard; the bridge token cannot use them.
  app.get('/api/external-mcp/access', async (_req, res) => {
    res.header('Cache-Control', 'no-store');
    return externalMcpInfo(settings);
  });
  app.put('/api/external-mcp/access', async (req, res) => {
    const input = z.object({ enabled: z.boolean(), write: z.boolean() }).strict().parse(req.body);
    if (input.enabled) await enableExternalAccess(service.directory, input.write);
    else await disableExternalAccess(service.directory);
    res.header('Cache-Control', 'no-store');
    return externalMcpInfo(settings);
  });
  app.register(async (bridge) => registerBridge(bridge, service));
};

const registerBridge = (app: FastifyInstance, service: CrewService) => {
  // Authenticate before body parsing, independently of browser sessions and crew run tokens.
  app.addHook('onRequest', async (req, res) => {
    if (!(await authorizeExternalAccess(service.directory, req.headers.authorization)))
      return res.status(403).send({
        error:
          'External MCP access is disabled or revoked. Run the MCP enable command and reconnect.',
      });
  });
  app.post('/api/external-mcp', async (req, res) => {
    const access = await authorizeExternalAccess(service.directory, req.headers.authorization);
    if (!access)
      return res
        .status(403)
        .send({ error: 'External MCP access was revoked. Reconnect after enabling access.' });
    const { action, input } = externalRequest.parse(req.body);
    const tool = externalTools[action];
    if ('write' in tool && tool.write && !access.write)
      return res.status(403).send({
        error: 'This external MCP connection is read-only. The user must enable write access.',
      });
    res.header('Cache-Control', 'no-store');
    return service.externalCall(action, input);
  });
};
