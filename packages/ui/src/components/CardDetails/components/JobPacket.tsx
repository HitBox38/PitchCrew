import { packetDocumentLabels } from '@/lib/packet-labels.ts';
import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import { PacketDocumentPicker } from '@/components/CardDetails/components/PacketDocumentPicker.tsx';
import type { JobPacketProps } from '@/components/CardDetails/types.ts';
import { ShieldCheck } from 'lucide-react';

export const JobPacket = ({ document, setDocument, card }: JobPacketProps) => {
  if (!card.packet) return null;
  return (
    <>
      <PacketDocumentPicker document={document} setDocument={setDocument} />
      <SourceBlock
        label={packetDocumentLabels[document]}
        value={card.packet[document]}
        contentClassName="font-sans text-body leading-relaxed"
      />
      <h3>Sources</h3>
      <p className="quiet">
        Each claim quotes your profile notes word for word. Reviewer reads the whole packet as well.
      </p>
      {card.packet.claims.map((claim, i) => (
        <div className="evidence" key={i}>
          <ShieldCheck size={16} />
          <div>
            <p>{claim.claim}</p>
            <small>{claim.source}</small>
          </div>
        </div>
      ))}
    </>
  );
};
