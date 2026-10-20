import { Link } from '@tanstack/react-router';
import type { ReactNode, MouseEvent } from 'react';
import type { CrewNotification } from '../types.ts';

export const NotificationLink = ({
  item,
  onOpen,
  className,
  children,
}: {
  item: CrewNotification;
  onOpen: (item: CrewNotification) => void;
  className?: string;
  children: ReactNode;
}) => {
  const props = {
    className,
    onClick: (event: MouseEvent<HTMLAnchorElement>) => {
      if (
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey &&
        event.button === 0
      )
        onOpen(item);
    },
  };
  if (item.target === '/settings')
    return (
      <Link
        to="/settings"
        search={{ section: 'runtimes', runtime: item.reviewId }}
        hash={item.reviewId ? `runtime-${item.reviewId}` : undefined}
        {...props}
      >
        {children}
      </Link>
    );
  if (item.target === '/crew')
    return (
      <Link to="/crew" search={{ review: item.reviewId }} {...props}>
        {children}
      </Link>
    );
  if (item.target === '/skills')
    return (
      <Link to="/skills" search={{ skill: item.reviewId, review: true }} {...props}>
        {children}
      </Link>
    );
  return item.target === '/inbox' ? (
    <Link to="/inbox" {...props}>
      {children}
    </Link>
  ) : (
    <Link to="/chat/$thread" params={{ thread: item.target.slice(6) }} {...props}>
      {children}
    </Link>
  );
};
