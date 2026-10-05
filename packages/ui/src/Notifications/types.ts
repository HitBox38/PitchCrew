export type NotificationContext =
  | 'message'
  | 'input'
  | 'packet_approval'
  | 'browser_approval'
  | 'role_proposal'
  | 'skill_proposal'
  | 'instruction_update';

export interface CrewNotification {
  id: string;
  kind: 'message' | 'attention';
  context: NotificationContext;
  title: string;
  body: string;
  target: '/inbox' | '/crew' | `/chat/${string}`;
  createdAt: string;
}
export interface NotificationPreferences {
  sound: boolean;
}
