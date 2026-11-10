import { Sheet } from '@pitchcrew/design-system/sheet';
import { Dialog as SheetPrimitive } from '@base-ui/react/dialog';
import { useState, type ReactNode } from 'react';
import { chatWorkspacePresence } from '@/ChatView/presence.ts';

/** A non-modal sheet docked in its parent's layout, keeping the workspace usable. */
export const SidePanel = ({
  children,
  onClose,
  className = '',
  returnFocus = '.chat-heading button[aria-label="Conversation options"]',
}: {
  children: ReactNode;
  onClose: () => void;
  className?: string;
  returnFocus?: string;
}) => {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  chatWorkspacePresence.usePresent('side-panel');
  return (
    <div className="chat-side-panel-slot" ref={setContainer}>
      <Sheet
        open
        modal={false}
        disablePointerDismissal
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        {container ? (
          <SheetPrimitive.Portal container={container} className="chat-side-panel-portal">
            <SheetPrimitive.Popup
              className={`chat-side-panel ${className}`}
              data-slot="chat-side-panel"
              finalFocus={() => document.querySelector<HTMLElement>(returnFocus)}
            >
              {children}
            </SheetPrimitive.Popup>
          </SheetPrimitive.Portal>
        ) : null}
      </Sheet>
    </div>
  );
};
