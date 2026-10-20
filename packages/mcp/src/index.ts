import { digestArtifacts, type Board } from '@pitchcrew/board';
import type { Approval } from '@pitchcrew/core';
import {
  verifiedArtifact,
  writePacket,
  verifyDocument,
  expectedDocumentText,
} from '@pitchcrew/packet';

// All export callers enter the same MCP gate. No UI/HTTP code consumes tokens directly.
export async function exportApprovedPacket(
  board: Board,
  directory: string,
  approvalId: string,
  assertReady?: () => void,
) {
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
  const packet = board.consumeApproval(approvalId, approval.cardId, approval.digest);
  const output = await writePacket(directory, approval.cardId, packet, approval.artifacts);
  board.record(
    'approval',
    { ...approval, status: 'consumed', exportDirectory: output },
    'mcp',
    'Exported approved packet locally',
  );
  return output;
}
