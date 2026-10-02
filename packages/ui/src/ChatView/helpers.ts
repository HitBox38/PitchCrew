export function messageDay(date: string) {
  const value = new Date(date);
  if (value.toDateString() === new Date().toDateString()) return 'Today';
  return value.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: value.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}
