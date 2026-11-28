import { keyedItems } from '@/lib/list-keys.ts';
import { packetDocumentLabels } from '@pitchcrew/core/packet-documents';
import { PacketDocumentView } from '@/components/CardDetails/components/PacketDocumentView.tsx';
import { PacketDocumentPicker } from '@/components/CardDetails/components/PacketDocumentPicker.tsx';
import type { JobPacketProps } from '@/components/CardDetails/types.ts';
import { ShieldCheck } from 'lucide-react';

export const JobPacket = ({ document, setDocument, card }: JobPacketProps) => {
  if (!card.packet) return null;
  return (
    <>
      <PacketDocumentPicker document={document} setDocument={setDocument} />
      <PacketDocumentView label={packetDocumentLabels[document]} text={card.packet[document]} />
      <h3>Sources</h3>
      <p className="quiet">Each claim quotes your Profile notes word for word.</p>
      {keyedItems(card.packet.claims, (claim) => JSON.stringify(claim)).map(
        ({ item: claim, key }) => (
          <div className="evidence" key={key}>
            <ShieldCheck size={16} />
            <div>
              <p>{claim.claim}</p>
              <small>{claim.source}</small>
            </div>
          </div>
        ),
      )}
    </>
  );
};
