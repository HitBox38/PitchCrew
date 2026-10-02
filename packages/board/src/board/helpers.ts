import { type Packet } from '@pitchcrew/core';
import { createHash } from 'node:crypto';

export function digestPacket(cardId: string, packet: Packet) {
  return createHash('sha256')
    .update(JSON.stringify({ cardId, action: 'export_packet', packet }))
    .digest('hex');
}
