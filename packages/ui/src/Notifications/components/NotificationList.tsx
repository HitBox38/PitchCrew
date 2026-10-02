import { NotificationLink } from './NotificationLink.tsx';
import { NotificationIcon } from './NotificationIcon.tsx';
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
        <li
          key={item.id}
          className="notification-context"
          data-context={item.context}
          data-unread={!read.includes(item.id)}
        >
          <NotificationLink item={item} onOpen={onOpen} className="notification-link">
            <span className="notification-item-heading">
              <NotificationIcon context={item.context} />
              <strong>{item.title}</strong>
            </span>
            <span>{item.body.slice(0, 240)}</span>
            <small>
              {item.kind === 'attention' ? 'Needs your attention · ' : ''}
              <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
            </small>
          </NotificationLink>
        </li>
      ))}
    </ul>
  );
}
