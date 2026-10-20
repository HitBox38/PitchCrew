import { type Packet } from '@pitchcrew/core';
import { createHash } from 'node:crypto';

export const digestPacket = (cardId: string, packet: Packet) => {
  return createHash('sha256')
    .update(JSON.stringify({ cardId, action: 'export_packet', packet }))
    .digest('hex');
};

export const digestArtifacts = (artifacts: import('@pitchcrew/core').PacketArtifact[]) => {
  return createHash('sha256').update(JSON.stringify(artifacts)).digest('hex');
};
