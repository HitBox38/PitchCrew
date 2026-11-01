import type { Card, Packet } from '@pitchcrew/core';
import { PacketDocuments } from '@/ChatView/components/PacketDocuments.tsx';
import { browserPacketPanelId } from './BrowserViewSwitch.tsx';

/** The job's packet in the browser panel's Packet tab, read-only. */
export const BrowserPacketView = ({ card, packet }: { card: Card; packet: Packet }) => (
  <section
    id={browserPacketPanelId}
    role="tabpanel"
    aria-labelledby={`${browserPacketPanelId}-tab`}
    className="browser-packet-view"
  >
    <PacketDocuments card={card} packet={packet} />
  </section>
);
