import type { Board } from '@pitchcrew/board';
import type { Approval } from '@pitchcrew/core';
import { writePacket } from '@pitchcrew/packet';

// All export callers enter the same MCP gate. No UI/HTTP code consumes tokens directly.
export async function exportApprovedPacket(board: Board, directory: string, approvalId: string) {
  const approval = board.get<Approval>('approval', approvalId);
  const packet = board.consumeApproval(approvalId, approval.cardId, approval.digest);
  const output = await writePacket(directory, approval.cardId, packet);
  board.record(
    'approval',
    { ...approval, status: 'consumed', exportDirectory: output },
    'mcp',
    'Exported approved packet locally',
  );
  return output;
}
