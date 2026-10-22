import { assertReviewedContext, digestPacket, digestArtifacts, type Board } from '@pitchcrew/board';
import type { Approval, Card } from '@pitchcrew/core';
import {
  verifiedArtifact,
  writePacket,
  verifyDocument,
  expectedDocumentText,
} from '@pitchcrew/packet';

// All export callers enter the same MCP gate. No UI/HTTP code consumes tokens directly.
export const exportApprovedPacket = async (
  board: Board,
  directory: string,
  approvalId: string,
  assertReady?: () => void,
) => {
  const approval = board.get<Approval>('approval', approvalId);
  if (approval.artifacts && approval.artifactDigest !== digestArtifacts(approval.artifacts))
    throw new Error('Reviewed artifacts changed.');
  for (const artifact of approval.artifacts ?? []) {
    verifiedArtifact(artifact);
    const verification = await verifyDocument(
      artifact,
      artifact.layout
        ? expectedDocumentText(approval.packet[artifact.source], artifact.layout)
        : [
            expectedDocumentText(approval.packet[artifact.source], 'formatted'),
            expectedDocumentText(approval.packet[artifact.source], 'plain'),
          ],
    );
    if (verification.status === 'blocked')
      throw new Error(
        `${artifact.name}: ${verification.findings
          .filter((f) => f.severity === 'error')
          .map((f) => f.message)
          .join(' ')}`,
      );
  }
  assertReady?.();
  // Recover only an unfinished export of the same already-consumed approval, to one stable directory.
  const recovering = approval.status === 'consumed' && !approval.exportDirectory;
  if (recovering) {
    const card = board.get<Card>('card', approval.cardId);
    if (
      card.state !== 'awaiting_approval' ||
      !card.packet ||
      digestPacket(card.id, card.packet) !== approval.digest ||
      assertReviewedContext(card).revision !== approval.contextRevision
    )
      throw new Error('The application changed after export failed. Request a fresh approval.');
  }
  const packet = recovering
    ? approval.packet
    : board.consumeApproval(approvalId, approval.cardId, approval.digest);
  const output = await writePacket(
    directory,
    approval.cardId,
    packet,
    approval.artifacts,
    approval.id,
  );
  board.record(
    'approval',
    { ...approval, status: 'consumed', exportDirectory: output },
    'mcp',
    'Exported approved packet locally',
  );
  return output;
};
