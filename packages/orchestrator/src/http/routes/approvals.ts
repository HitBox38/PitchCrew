import type { Card, Approval } from '@pitchcrew/core';
import { digestPacket } from '@pitchcrew/board';
import { renderArtifacts, verifiedArtifact } from '@pitchcrew/packet';
import { resolveSubmission } from '@pitchcrew/mcp/computer';
import express from 'express';
import { z } from 'zod';
import { CrewService } from '../../service.ts';

export function registerApprovalsRoutes(app: express.Express, service: CrewService) {
  app.post('/api/cards/:id/approval', async (req, res) => {
    const { formats } = z
      .object({
        formats: z
          .array(z.enum(['pdf', 'docx']))
          .max(2)
          .default([]),
      })
      .parse(req.body ?? {});
    const card = service.board.get<Card>('card', req.params.id);
    if (card.state !== 'agreed' || !card.packet) throw new Error('A reviewed packet is required.');
    const digest = digestPacket(card.id, card.packet);
    const artifacts = await renderArtifacts(card.packet, [...new Set(formats)]);
    const current = service.board.get<Card>('card', card.id);
    if (!current.packet || digestPacket(card.id, current.packet) !== digest)
      throw new Error('Packet changed during rendering.');
    res.status(201).json(service.board.requestApproval(card.id, artifacts));
  });
  app.get('/api/approvals/:id/artifacts/:name', (req, res) => {
    const approval = service.board.get<Approval>('approval', req.params.id);
    const artifact = approval.artifacts?.find((item) => item.name === req.params.name);
    if (!artifact) throw new Error('Reviewed artifact not found.');
    res.setHeader('Content-Disposition', `inline; filename="${artifact.name}"`);
    res.type(artifact.mimeType).send(verifiedArtifact(artifact));
  });
  app.post('/api/submissions/:id/resolve', (req, res) => {
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
    res.json(
      resolveSubmission(
        service.board,
        z.uuid().parse(req.params.id),
        input.confirmed,
        input.reason,
        input.external,
      ),
    );
  });
  app.post('/api/approvals/:id/decide', (req, res) =>
    res.json(
      service.board.decideApproval(
        req.params.id,
        z.object({ approved: z.boolean() }).parse(req.body).approved,
      ),
    ),
  );
  app.post('/api/computer-approvals/:id/decide', (req, res) =>
    res.json(
      service.computer.decide(
        z.uuid().parse(req.params.id),
        z.object({ approved: z.boolean() }).parse(req.body).approved,
      ),
    ),
  );
  app.post('/api/approvals/:id/export', async (req, res) =>
    res.json({ directory: await service.exportPacket(req.params.id) }),
  );
}
