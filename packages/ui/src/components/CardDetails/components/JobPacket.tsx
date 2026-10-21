import { keyedItems } from '@/lib/list-keys.ts';
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
