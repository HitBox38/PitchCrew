import { NotificationLink } from './NotificationLink.tsx';
import { NotificationIcon } from './NotificationIcon.tsx';
import type { CrewNotification } from '../types.ts';
import { notificationPresentation } from '../constants.ts';
import { notificationPreview } from '../helpers.ts';
import { timeAgo } from '@/lib/time.ts';

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
            <NotificationIcon context={item.context} />
            <span className="notification-item-content">
              <span className="notification-item-heading">
                <strong>{item.title}</strong>
                {!read.includes(item.id) ? (
                  <span className="notification-unread" role="img" aria-label="Unread" />
                ) : null}
              </span>
              <span className="notification-preview">{notificationPreview(item.body)}</span>
              <span className="notification-item-footer">
                <span className="notification-item-action">
                  {notificationPresentation[item.context].action}
                </span>
                <time dateTime={item.createdAt} title={new Date(item.createdAt).toLocaleString()}>
                  {timeAgo(item.createdAt)}
                </time>
              </span>
            </span>
          </NotificationLink>
        </li>
      ))}
    </ul>
  );
}
