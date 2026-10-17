import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adapters } from '@pitchcrew/adapters';
import type { DeepReview, ReviewSubagent } from '@pitchcrew/core';
import type { CrewService } from '../../service.ts';
import type { IdRoute } from '../types.ts';
export function registerDeepReviewRoutes(app: FastifyInstance, service: CrewService) {
  app.get('/api/deep-review-support', () => ({
    runtimes: service.runtimes.map((runtime) => ({
      ...runtime,
      reviewSubagents: adapters[runtime.id].reviewSubagents ?? null,
      applicationIsolation: adapters[runtime.id].applicationIsolation === true,
    })),
  }));
  app.post<IdRoute>('/api/cards/:id/deep-reviews', async (req, res) =>
    res
      .status(202)
      .send(await service.startDeepReview(z.uuid().parse(req.params.id), req.body ?? {})),
  );
  app.get<IdRoute>('/api/cards/:id/deep-reviews', (req) => {
    const id = z.uuid().parse(req.params.id);
    service.board.get('card', id);
    const { offset } = z
      .object({ offset: z.coerce.number().int().min(0).default(0) })
      .parse(req.query);
    const rows = service.board.db
      .prepare(
        "SELECT json_extract(json,'$.id') AS id,json_extract(json,'$.cardId') AS cardId,json_extract(json,'$.runId') AS runId,json_extract(json,'$.status') AS status,json_extract(json,'$.stage') AS stage,json_extract(json,'$.summary') AS summary,json_extract(json,'$.createdAt') AS createdAt,json_extract(json,'$.updatedAt') AS updatedAt,json_extract(json,'$.deadlineAt') AS deadlineAt FROM entities WHERE kind='deep_review' AND json_extract(json,'$.cardId')=? ORDER BY rowid DESC LIMIT 11 OFFSET ?",
      )
      .all(id, offset);
    return { reviews: rows.slice(0, 10), nextOffset: rows.length > 10 ? offset + 10 : null };
  });
  app.get<{ Params: { id: string; reviewId: string } }>(
    '/api/cards/:id/deep-reviews/:reviewId',
    (req) => {
      const id = z.uuid().parse(req.params.id);
      service.board.get('card', id);
      const report = service.board.get<DeepReview>(
        'deep_review',
        z.uuid().parse(req.params.reviewId),
      );
      if (report.cardId !== id) throw new Error('Review does not belong to this job.');
      const { offset } = z
        .object({ offset: z.coerce.number().int().min(0).default(0) })
        .parse(req.query);
      const children = service.board.db
        .prepare(
          "SELECT json FROM entities WHERE kind='review_subagent' AND json_extract(json,'$.reviewId')=? ORDER BY rowid LIMIT 21 OFFSET ?",
        )
        .all(report.id, offset) as { json: string }[];
      return {
        report,
        subagents: children.slice(0, 20).map((row) => JSON.parse(row.json) as ReviewSubagent),
        nextOffset: children.length > 20 ? offset + 20 : null,
      };
    },
  );
}
