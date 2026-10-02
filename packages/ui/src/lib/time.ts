export function timeAgo(date: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 60000));
  return mins < 1
    ? 'Just now'
    : mins < 60
      ? `${mins}m ago`
      : mins < 1440
        ? `${Math.floor(mins / 60)}h ago`
        : new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
