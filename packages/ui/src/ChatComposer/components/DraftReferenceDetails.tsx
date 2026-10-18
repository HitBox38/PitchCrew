import { Popover } from '@base-ui/react/popover';
import type { ReferenceValue } from '@/ChatReferences/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';

export function DraftReferenceDetails({
  anchor,
  reference,
  close,
  remove,
}: {
  anchor: HTMLElement;
  reference: ReferenceValue;
  close: () => void;
  remove: () => void;
}) {
  return (
    <Popover.Root
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Popover.Portal>
        <Popover.Positioner anchor={anchor} side="top" sideOffset={8} className="z-50">
          <Popover.Popup className="ui-popover chat-reference-details" finalFocus={false}>
            <Popover.Title>
              {reference.kind === 'agent'
                ? 'Agent'
                : reference.kind === 'skill'
                  ? 'Skill'
                  : 'Action'}
              : {reference.label}
            </Popover.Title>
            <Popover.Description>
              {reference.kind === 'skill'
                ? 'Instructions selected for this message. Selection grants no extra tools or approvals.'
                : reference.kind === 'agent'
                  ? 'A conversation participant addressed by this message.'
                  : 'Prepares a deep resume review when you send the message.'}
            </Popover.Description>
            <Button size="sm" variant="outline" onClick={remove}>
              Remove from draft
            </Button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
