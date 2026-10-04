import type { FastifyInstance } from 'fastify';
import { PacketRulesError, validatePacketRules } from '../../packet-rules.ts';
import type { CrewService } from '../../service.ts';

/** User-only rule edits. Agents reach rules through the read-only gateway action instead. */
export function registerPacketRulesRoutes(app: FastifyInstance, service: CrewService) {
  app.get('/api/packet-rules', () => service.packetRules.current());
  app.post('/api/packet-rules/validate', (req) => {
    const result = validatePacketRules(req.body);
    return { valid: result.valid, issues: result.issues };
  });
  app.put('/api/packet-rules', (req, res) => {
    try {
      return service.packetRules.save(req.body);
    } catch (error) {
      if (!(error instanceof PacketRulesError)) throw error;
      return res.status(400).send({ error: error.message, issues: error.issues });
    }
  });
  app.delete('/api/packet-rules', () => service.packetRules.reset());
}
