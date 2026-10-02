import { notificationPresentation } from '../constants.ts';
import type { NotificationContext } from '../types.ts';

export function NotificationIcon({ context }: { context: NotificationContext }) {
  const Icon = notificationPresentation[context].icon;
  return (
    <span className="notification-context-icon" aria-hidden="true">
      <Icon size={17} />
    </span>
  );
}
