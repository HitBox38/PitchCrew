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
  | 'conversation_created'
  | 'chat_continued'
  | 'user_question_answered'
  | 'user_question_cancelled'
  | 'browser_session_changed'
  | 'pipeline_followup_saved'
  | 'app_update_download_requested'
  | 'app_update_install_requested'
  | 'agent_created'
  | 'agent_saved'
  | 'agent_retired'
  | 'agent_restored'
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
  action?: 'open' | 'close' | 'take' | 'release';
}
