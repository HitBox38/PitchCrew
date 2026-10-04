import { roleIdSchema } from '@pitchcrew/core';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { CrewService } from '../../service.ts';

export function registerAgentRoutes(app: FastifyInstance, service: CrewService) {
  app.post('/api/agent', async (req, res) => {
    const token = req.headers.authorization?.replace(/^Bearer /, '') ?? '';
    if (!service.capabilities.has(token))
      return res.status(403).send({ error: 'Invalid or expired run capability.' });
    const body = z
      .object({
        action: z.string(),
        packet: z.unknown().optional(),
        approvalId: z.uuid().optional(),
        beforeEventId: z.number().int().positive().optional(),
        limit: z.number().int().min(1).max(200).optional(),
        roleId: roleIdSchema.optional(),
        content: z.string().max(8000).optional(),
        kind: z.enum(['message', 'attention']).optional(),
        mode: z.enum(['chat', 'workflow']).optional(),
        reason: z.string().max(2000).optional(),
        changes: z.unknown().optional(),
        suggestion: z.unknown().optional(),
        state: z.enum(['shortlisted', 'changes_requested']).optional(),
        tool: z.string().max(100).optional(),
        input: z.unknown().optional(),
        routineId: z.uuid().optional(),
      })
      .parse(req.body);
    return res.send(await service.agentCall(token, body.action, body));
  });
}
