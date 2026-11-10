import { timeAgo, useClock } from '@/lib/time.ts';

export const MessageTimestamp = ({
  createdAt,
  timestamp = createdAt,
}: {
  createdAt: string;
  timestamp?: string;
}) => {
  useClock();
  return (
    <time
      dateTime={timestamp}
      title={
        timestamp !== createdAt
          ? `Written ${new Date(createdAt).toLocaleString()} · Sent ${new Date(timestamp).toLocaleString()}`
          : new Date(timestamp).toLocaleString()
      }
    >
      {timeAgo(timestamp)}
    </time>
  );
};
