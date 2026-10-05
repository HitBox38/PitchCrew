import type { View } from '../navigation.ts';

export interface AnalyticsConfig {
  token: string;
  host: string;
}

export type AnalyticsEvent =
  | '$pageview'
  | 'job_created'
  | 'application_registered'
  | 'applications_imported'
  | 'application_status_changed'
  | 'workflow_started'
  | 'chat_sent'
  | 'agent_created'
  | 'agent_saved'
  | 'agent_retired'
  | 'skill_saved'
  | 'skill_deleted'
  | 'routine_saved'
  | 'routine_deleted'
  | 'profile_saved'
  | 'job_sources_scanned'
  | 'packet_export_requested'
  | 'approval_decided'
  | 'packet_exported'
  | 'onboarding_updated';

export interface AnalyticsProperties {
  page?: View;
  state?: string;
  kind?: 'packet' | 'computer' | 'role' | 'skill';
  approved?: boolean;
  status?: string;
  step?: number;
}
