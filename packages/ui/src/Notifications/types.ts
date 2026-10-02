export interface CrewNotification {
  id: string;
  kind: 'message' | 'attention';
  title: string;
  body: string;
  target: '/inbox' | '/chat/scout' | '/chat/writer' | '/chat/reviewer' | '/chat/crew';
  createdAt: string;
}
export interface NotificationPreferences {
  sound: boolean;
}
