import { assertExtractedContext, digestPacket } from '@pitchcrew/board';
import { runResultSchema, type Card, type Run } from '@pitchcrew/core';
import type { CrewContext } from './types.ts';

/** Advisory only: never changes packet review, approvals, feedback or workflow status. */
export const applyPacketEvaluation = (context: CrewContext, run: Run, data: unknown): void => {
  const result = runResultSchema.parse(data);
  if (result.role !== 'scout' || !result.packetFit)
    throw new Error('Reevaluation must include a packet-to-job rating and reasons.');
  const card = context.board.get<Card>('card', run.cardId!);
  const brief = assertExtractedContext(card);
  if (
    !card.packet ||
    brief.revision !== run.contextRevision ||
    digestPacket(card.id, card.packet) !== run.inputPacketDigest
  )
    throw new Error('The packet or job brief changed. Request a fresh reevaluation.');
  context.board.updateCard(
    card.id,
    {
      fit: result.fit,
      packetFit: {
        ...result.packetFit,
        fitReasons: result.reasons,
        packetDigest: run.inputPacketDigest,
        contextRevision: brief.revision,
        runId: run.id,
        evaluatedAt: new Date().toISOString(),
      },
    },
    run.roleId,
    `Reevaluated the complete packet: ${result.packetFit.score}/100 packet match; ${result.fit}/100 candidate fit`,
  );
};
