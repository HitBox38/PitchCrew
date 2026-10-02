import { Button } from '@/components/ui/button/components/Button.tsx';
import { X } from 'lucide-react';
import type { CrewNotification } from '../types.ts';

export function NotificationToast({
  item,
  hidden,
  onOpen,
  onDismiss,
}: {
  item: CrewNotification | null;
  hidden: boolean;
  onOpen: (item: CrewNotification) => void;
  onDismiss: () => void;
}) {
  return (
    <>
      <output className="sr-only" aria-live="polite">
        {item ? `${item.title}. ${item.body}` : ''}
      </output>
      {item && !hidden ? (
        <div className={`crew-notification crew-notification-${item.kind}`}>
          <Button className="notification-link" onClick={() => onOpen(item)}>
            <strong>{item.title}</strong>
            <span>{item.body.slice(0, 240)}</span>
            <small>{item.target === '/inbox' ? 'Review in Inbox' : 'Open conversation'}</small>
          </Button>
          <Button
            className="icon-button"
            aria-label="Dismiss crew notification"
            onClick={onDismiss}
          >
            <X size={15} />
          </Button>
        </div>
      ) : null}
    </>
  );
}
