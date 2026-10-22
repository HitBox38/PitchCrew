import type { Card, Approval } from '@pitchcrew/core';
import { assertReviewedContext, digestPacket } from '@pitchcrew/board';
import { prepareVerifiedArtifacts, systemFonts, verifiedArtifact } from '@pitchcrew/packet';
import { resolveSubmission } from '@pitchcrew/mcp/computer';
import type { FastifyInstance } from 'fastify';
import { join } from 'node:path';
import { z } from 'zod';
import type { IdRoute } from '../types.ts';
import { CrewService } from '../../service.ts';

export const registerApprovalsRoutes = (app: FastifyInstance, service: CrewService) => {
  app.post<IdRoute>('/api/cards/:id/approval', async (req, res) => {
    const { formats, layout } = z
      .object({
        formats: z
          .array(z.enum(['pdf', 'docx']))
          .max(2)
          .default([]),
        layout: z.enum(['formatted', 'plain']).default('formatted'),
      })
      .parse(req.body ?? {});
    const card = service.board.get<Card>('card', req.params.id);
    if (service.board.hasActiveRun(card.id))
      throw new Error('Wait for application work to finish before requesting export approval.');
    const contextRevision = assertReviewedContext(card).revision;
    if (card.state !== 'agreed' || !card.packet) throw new Error('A reviewed packet is required.');
    const digest = digestPacket(card.id, card.packet);
    // Fonts in the data folder's fonts folder come before installed system fonts.
    const { artifacts, reports } = await prepareVerifiedArtifacts(
      card.packet,
      [...new Set(formats)],
      layout,
      {
        fonts: systemFonts({ folders: [join(service.directory, 'fonts')] }),
      },
    );
    const current = service.board.get<Card>('card', card.id);
    if (service.board.hasActiveRun(card.id))
      throw new Error('Application work started during verification. Retry after it finishes.');
    if (assertReviewedContext(current).revision !== contextRevision)
      throw new Error('Application context changed during rendering.');
    if (!current.packet || digestPacket(card.id, current.packet) !== digest)
      throw new Error('Packet changed during rendering.');
    if (formats.length && !artifacts.length)
      throw new Error(
        reports
          .flatMap((report) =>
            report.findings
              .filter((f) => f.severity === 'error')
              .map((f) => `${report.name}: ${f.message}`),
          )
          .join('\n'),
      );
    res.status(201).send(service.board.requestApproval(card.id, artifacts, reports));
  });
  app.get<{ Params: { id: string; name: string } }>(
    '/api/approvals/:id/artifacts/:name',
    (req, res) => {
      const approval = service.board.get<Approval>('approval', req.params.id);
      const artifact = approval.artifacts?.find((item) => item.name === req.params.name);
      if (!artifact) throw new Error('Reviewed artifact not found.');
      res.header('Content-Disposition', `inline; filename="${artifact.name}"`);
      res.type(artifact.mimeType).send(verifiedArtifact(artifact));
    },
  );
  app.post<IdRoute>('/api/submissions/:id/resolve', (req, res) => {
    const input = z
      .object({
        confirmed: z.boolean(),
        reason: z.string().trim().min(1).max(2000),
        external: z
          .object({
            url: z
              .url()
              .max(2000)
              .refine((value) => ['https:', 'http:'].includes(new URL(value).protocol)),
            evidence: z.string().trim().min(1).max(4000),
            verified: z.literal(true),
          })
          .strict()
          .optional(),
      })
      .parse(req.body);
    res.send(
      resolveSubmission(
        service.board,
        z.uuid().parse(req.params.id),
        input.confirmed,
        input.reason,
        input.external,
      ),
    );
  });
  app.post<IdRoute>('/api/approvals/:id/decide', (req, res) =>
    res.send(
      service.board.decideApproval(
        req.params.id,
        z.object({ approved: z.boolean() }).parse(req.body).approved,
      ),
    ),
  );
  app.post<IdRoute>('/api/computer-approvals/:id/decide', (req, res) =>
    res.send(
      service.computer.decide(
        z.uuid().parse(req.params.id),
        z.object({ approved: z.boolean() }).parse(req.body).approved,
      ),
    ),
  );
  app.post<IdRoute>('/api/approvals/:id/complete', (req) =>
    service.completeSubmission(req.params.id, req.body),
  );
  app.post<IdRoute>('/api/approvals/:id/submit', async (req) =>
    service.startSubmission(req.params.id, req.body),
  );
  app.post<IdRoute>('/api/approvals/:id/export', async (req, res) =>
    res.send({ directory: await service.exportPacket(req.params.id) }),
  );
};
