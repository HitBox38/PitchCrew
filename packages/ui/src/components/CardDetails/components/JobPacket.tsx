import { PacketDocumentPicker } from '@/components/CardDetails/components/PacketDocumentPicker.tsx';
import type { JobPacketProps } from '@/components/CardDetails/types.ts';
import { ShieldCheck } from 'lucide-react';

export function JobPacket({ document, setDocument, card }: JobPacketProps) {
  if (!card.packet) return null;
  return (
    <>
      <PacketDocumentPicker document={document} setDocument={setDocument} />
      <pre className="packet-document">{card.packet[document]}</pre>
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
}
