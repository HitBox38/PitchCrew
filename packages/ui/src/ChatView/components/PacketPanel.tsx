import type { ChatViewModel } from '../types.ts';
import { ChatSidePanel } from './ChatSidePanel.tsx';
import { PacketDocuments } from './PacketDocuments.tsx';

/** The job's current packet beside the conversation, read-only; approval stays in Decisions. */
export const PacketPanel = ({
  attached,
  setDialog,
}: Pick<ChatViewModel, 'attached' | 'setDialog'>) => {
  const packet = attached?.packet;
  if (!attached || !packet) return null;
  return (
    <ChatSidePanel
      title={`${attached.company} packet`}
      onClose={() => setDialog(null)}
      className="chat-packet-panel"
    >
      <PacketDocuments card={attached} packet={packet} />
    </ChatSidePanel>
  );
};
