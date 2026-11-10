import type { FastifyInstance } from 'fastify';
import type { ExternalMcpInfo } from '@pitchcrew/core';
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

type ExternalAttempt = NonNullable<ExternalMcpInfo['lastAttempt']>;

export const registerExternalMcpRoutes = (app: FastifyInstance, service: CrewService) => {
  const settings = { directory: service.directory, port: Number(new URL(service.daemonUrl).port) };
  let activity:
    | {
        token: string;
        lastRequest?: { token: string; action: string; at: string };
        lastAttempt?: { token: string } & ExternalAttempt;
      }
    | undefined;
  // These management routes retain the root user-session guard; the bridge token cannot use them.
  app.get('/api/external-mcp/access', async (_req, res) => {
    res.header('Cache-Control', 'no-store');
    return externalMcpInfo(settings, activity?.lastRequest, activity?.lastAttempt);
  });
  app.put('/api/external-mcp/access', async (req, res) => {
    const input = z.object({ enabled: z.boolean(), write: z.boolean() }).strict().parse(req.body);
    if (input.enabled) await enableExternalAccess(service.directory, input.write);
    else await disableExternalAccess(service.directory);
    res.header('Cache-Control', 'no-store');
    return externalMcpInfo(settings);
  });
  app.register(async (bridge) =>
    registerBridge(bridge, service, (token) => {
      if (activity?.token !== token) activity = { token };
      // In-flight calls from an older grant finish into their own detached slot.
      const grant = activity;
      return (action, outcome) => {
        const at = new Date().toISOString();
        grant.lastAttempt = { token, action, at, outcome };
        if (outcome === 'succeeded') grant.lastRequest = { token, action, at };
      };
    }),
  );
};

const registerBridge = (
  app: FastifyInstance,
  service: CrewService,
  beginRequest: (token: string) => (action: string, outcome: ExternalAttempt['outcome']) => void,
) => {
  // Authenticate before body parsing, independently of browser sessions and crew run tokens.
  app.addHook('onRequest', async (req, res) => {
    if (!(await authorizeExternalAccess(service.directory, req.headers.authorization)))
      return res.status(403).send({
        error:
          'External MCP access is disabled or revoked. Check Settings > Accounts > External agents in Pitchcrew, then reconnect this app.',
      });
  });
  app.post('/api/external-mcp', async (req, res) => {
    const access = await authorizeExternalAccess(service.directory, req.headers.authorization);
    if (!access)
      return res
        .status(403)
        .send({ error: 'External MCP access was revoked. Reconnect after enabling access.' });
    const { action, input } = externalRequest.parse(req.body);
    res.header('Cache-Control', 'no-store');
    const recordRequest = beginRequest(access.token);
    const tool = externalTools[action];
    if ('write' in tool && tool.write && !access.write) {
      recordRequest(action, 'read-only');
      return res.status(403).send({
        error: 'This external MCP connection is read-only. The user must enable write access.',
      });
    }
    try {
      const result = await service.externalCall(action, input);
      recordRequest(action, 'succeeded');
      return result;
    } catch (error) {
      recordRequest(action, 'failed');
      throw error;
    }
  });
};
