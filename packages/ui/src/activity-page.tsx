import { timeAgo } from './components.tsx';
import { useWorkspace } from './workspace-context.tsx';

export function ActivityPage() {
  const { data } = useWorkspace();
  return (
    <section className="activity-panel">
      <ol className="activity-list">
        {data.events.map((event) => (
          <li className={`activity-row ${event.kind}`} key={event.id}>
            <time dateTime={event.createdAt} title={event.createdAt}>
              {timeAgo(event.createdAt)}
            </time>
            <span className="activity-message">{event.message}</span>
            <span className="activity-actor">
              {event.actor === 'user'
                ? 'You'
                : event.actor === 'demo'
                  ? 'Demo runtime'
                  : event.actor}
              <span className="activity-kind">{event.kind}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
