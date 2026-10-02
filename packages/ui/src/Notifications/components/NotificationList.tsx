import { Button } from '@/components/ui/button/components/Button.tsx';
import { Bell, MessageCircle } from 'lucide-react';
import type { CrewNotification } from '../types.ts';

export function NotificationList({
  items,
  read,
  onOpen,
}: {
  items: CrewNotification[];
  read: string[];
  onOpen: (item: CrewNotification) => void;
}) {
  if (!items.length)
    return (
      <p className="quiet notification-empty">
        Your crew’s messages and requests will appear here.
      </p>
    );
  return (
    <ul className="notification-list">
      {items.map((item) => (
        <li key={item.id} data-unread={!read.includes(item.id)}>
          <Button className="notification-link" onClick={() => onOpen(item)}>
            <span className="notification-item-heading">
              {item.kind === 'attention' ? <Bell size={15} /> : <MessageCircle size={15} />}
              <strong>{item.title}</strong>
            </span>
            <span>{item.body.slice(0, 240)}</span>
            <small>
              {item.kind === 'attention' ? 'Needs your attention · ' : ''}
              <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
            </small>
          </Button>
        </li>
      ))}
    </ul>
  );
}
