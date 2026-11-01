import type { CrewNotification, NotificationGroupId } from '../types.ts';
import { NotificationRow } from './NotificationRow.tsx';

export const NotificationList = ({
  groups,
  read,
  close,
}: {
  groups: { id: NotificationGroupId; title: string; items: CrewNotification[] }[];
  read: string[];
  close: () => void;
}) => {
  const readIds = new Set(read);
  if (!groups.length) return <p className="notification-empty">You’re up to date</p>;
  return (
    <div className="notification-groups">
      {groups.map((group) => (
        <section
          key={group.id}
          className="notification-group"
          aria-labelledby={`notification-group-${group.id}`}
        >
          <h3 id={`notification-group-${group.id}`}>
            {group.title} <span className="ui-count">{group.items.length}</span>
          </h3>
          <ul>
            {group.items.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                group={group.id}
                unread={!readIds.has(item.id)}
                close={close}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};
