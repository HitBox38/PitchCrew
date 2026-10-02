export interface NotificationPayload {
  id: string;
  title: string;
  body: string;
  kind: 'message' | 'attention';
  target: string;
}
export function parseNotification(value: unknown): NotificationPayload | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as Record<string, unknown>;
  if (
    typeof p.id !== 'string' ||
    !p.id.length ||
    p.id.length > 100 ||
    typeof p.title !== 'string' ||
    !p.title.length ||
    p.title.length > 160 ||
    typeof p.body !== 'string' ||
    p.body.length > 240 ||
    (p.kind !== 'message' && p.kind !== 'attention') ||
    typeof p.target !== 'string' ||
    !/^\/(inbox|chat\/(scout|writer|reviewer|crew))$/.test(p.target)
  )
    return null;
  return { id: p.id, title: p.title, body: p.body, kind: p.kind, target: p.target };
}
