import type { Card } from '@pitchcrew/core';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { openPacketFolder, packetFolderAvailable } from '../../crew/packet-folder.ts';
import { CrewService } from '../../service.ts';
import type { IdRoute } from '../types.ts';

/** User session only. Opens this job's own packet directory; the request carries no path. */
export const registerPacketFolderRoutes = (app: FastifyInstance, service: CrewService) => {
  const cardId = (id: string) => {
    const parsed = z.uuid().parse(id);
    service.board.get<Card>('card', parsed);
    return parsed;
  };
  app.get<IdRoute>('/api/cards/:id/packet-folder', async (req) => ({
    available: await packetFolderAvailable(service.directory, cardId(req.params.id)),
  }));
  app.post<IdRoute>('/api/cards/:id/packet-folder', async (req) => {
    await openPacketFolder(service.directory, cardId(req.params.id));
    return { ok: true };
  });
};
