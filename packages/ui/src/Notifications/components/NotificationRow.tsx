import type { RoleId } from '@pitchcrew/core';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { timeAgo } from '@/lib/time.ts';
import { notificationPresentation } from '../constants.ts';
import { notificationPreview } from '../helpers.ts';
import { openNotification } from '../open.ts';
import type { CrewNotification, NotificationGroupId } from '../types.ts';
import { NotificationLink } from './NotificationLink.tsx';

/**
 * One notice: the agent's pebble (or a bead), a title naming its object, one line with the actual
 * question, skill or subject, and when, in a fixed trailing lane.
 */
export const NotificationRow = ({
  item,
  group,
  unread,
  close,
}: {
  item: CrewNotification;
  group: NotificationGroupId;
  unread: boolean;
  close: () => void;
}) => (
  <li className="notification-context" data-context={item.context} data-unread={unread}>
    <NotificationLink
      item={item}
      onOpen={(entry) => {
        openNotification(entry);
        close();
      }}
      className="notification-link"
    >
      {item.roleId ? (
        <RoleAvatar agentRole={item.roleId as RoleId} size="small" />
      ) : (
        <span className="notification-bead" aria-hidden="true">
          <span
            className="clay-bead"
            data-size="sm"
            data-tone={group === 'needs' ? 'ochre' : undefined}
            data-empty={group === 'needs' ? undefined : ''}
          />
        </span>
      )}
      <span className="notification-item-content">
        <strong>{item.title}</strong>
        <span
          className="notification-item-detail"
          title={notificationPresentation[item.context].action}
        >
          {notificationPreview(item.body)}
        </span>
      </span>
      <span className="notification-item-meta">
        <time dateTime={item.createdAt} title={new Date(item.createdAt).toLocaleString()}>
          {timeAgo(item.createdAt)}
        </time>
        {unread ? (
          <span className="notification-unread">
            <span className="sr-only">Unread</span>
          </span>
        ) : null}
      </span>
    </NotificationLink>
  </li>
);
