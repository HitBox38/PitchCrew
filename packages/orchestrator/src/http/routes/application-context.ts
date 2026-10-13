import { jobSourceRevision, saveApplicationContext } from '@pitchcrew/board';
import { extractedJobSchema, roleIdSchema, type Card } from '@pitchcrew/core';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { CrewService } from '../../service.ts';
import type { IdRoute } from '../types.ts';
import { applicationSource } from '../../crew/application-context/source.ts';

export function registerApplicationContextRoutes(app: FastifyInstance, service: CrewService) {
  app.get<IdRoute>('/api/cards/:id/application-context', (req) => {
    const card = service.board.get<Card>('card', req.params.id);
    return {
      sourceRevision: jobSourceRevision(card),
      context: card.applicationContext ?? null,
      flagged: applicationSource(card).flagged,
    };
  });
  app.post<IdRoute>('/api/cards/:id/application-context/extract', (req) =>
    service.extractApplicationContext(
      req.params.id,
      z.object({ roleId: roleIdSchema }).strict().parse(req.body).roleId,
    ),
  );
  app.post<IdRoute>('/api/cards/:id/application-context/confirm', (req) => {
    const input = z
      .object({
        sourceRevision: z.string().length(64),
        expectedRevision: z.string().length(64).nullable(),
        context: extractedJobSchema,
      })
      .strict()
      .parse(req.body);
    const card = service.board.get<Card>('card', req.params.id);
    const hidden = applicationSource(card).flagged;
    const references = [
      input.context.brief.companyContext,
      ...input.context.brief.responsibilities,
      ...input.context.brief.qualifications,
      ...input.context.brief.constraints,
      ...input.context.requirements.map((r) => r.question),
    ]
      .join('\n')
      .toLowerCase()
      .replace(/\s+/g, ' ');
    for (const item of hidden) {
      if (
        !input.context.flagged.some(
          (flag) => flag.text === item.text && flag.reason === item.reason,
        )
      )
        throw new Error('Excluded source text changed. Reload and review the complete brief.');
      if (references.includes(item.text.toLowerCase().replace(/\s+/g, ' ')))
        throw new Error(
          'Excluded hidden source text cannot become an application requirement or brief instruction.',
        );
    }
    return saveApplicationContext(
      service.board,
      req.params.id,
      input.sourceRevision,
      input.expectedRevision,
      input.context,
      true,
    );
  });
  app.post<IdRoute>('/api/cards/:id/draft', (req) =>
    service.startApplicationDraft(
      req.params.id,
      z.object({ roleId: roleIdSchema }).strict().parse(req.body).roleId,
    ),
  );
}
