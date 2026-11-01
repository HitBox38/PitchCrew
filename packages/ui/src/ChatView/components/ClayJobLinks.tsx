import type { ConversationHeadingProps } from '../types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { BriefcaseBusiness, FileText } from 'lucide-react';

/** Job chats open the job and its packet from the header, as in the mock.
 * With a browser agent, the packet is a tab of the browser panel (see useMergedPacket). */
export const ClayJobLinks = ({
  attached,
  onOpenCard,
  dialog,
  setDialog,
  browserPanel,
}: ConversationHeadingProps) => {
  if (!attached) return null;
  const merged = browserPanel.available;
  const shown = merged ? browserPanel.open && browserPanel.view === 'packet' : dialog === 'packet';
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => onOpenCard(attached.id)}>
        <BriefcaseBusiness size={14} aria-hidden="true" /> <span>Job</span>
      </Button>
      {attached.packet ? (
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={shown}
          onClick={() => {
            if (!shown) setDialog('packet');
            else if (merged) browserPanel.hide();
            else setDialog(null);
          }}
        >
          <FileText size={14} aria-hidden="true" /> <span>Packet</span>
        </Button>
      ) : null}
    </>
  );
};
