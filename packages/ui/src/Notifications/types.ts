export type NotificationContext =
  | 'message'
  | 'input'
  | 'packet_approval'
  | 'browser_approval'
  | 'role_proposal'
  | 'skill_proposal'
  | 'instruction_update'
  | 'skill_update'
  | 'runtime_update'
  | 'remote_connection';

export interface CrewNotification {
  id: string;
  kind: 'message' | 'attention';
  context: NotificationContext;
  title: string;
  body: string;
  target: '/settings' | '/inbox' | '/crew' | '/skills' | `/chat/${string}`;
  reviewId?: string;
  /** The agent the notice comes from, shown as its pebble. */
  roleId?: string;
  createdAt: string;
}
export type NotificationGroupId = 'needs' | 'updates' | 'messages';
