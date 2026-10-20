/** Reviewed tool names only. Discovery/bootstrap gateway actions are intentionally absent. */
export const mcpGatewayTools = Object.freeze({
  quality: 'pitchcrew_application_quality',
  check_linkedin_draft: 'pitchcrew_check_linkedin_draft',
  start_deep_review: 'pitchcrew_start_deep_review',
  start_review_subagent: 'pitchcrew_start_review_subagent',
  review_subagents: 'pitchcrew_review_subagents',
  extend_review_deadline: 'pitchcrew_extend_review_deadline',
  request_review_time: 'pitchcrew_request_review_time',
  ask_user: 'pitchcrew_ask_user',
  chat_attachment: 'pitchcrew_read_chat_attachment',
  roles: 'pitchcrew_list_roles',
  notify_user: 'pitchcrew_notify_user',
  report_progress: 'pitchcrew_report_progress',
  messages: 'pitchcrew_read_messages',
  message: 'pitchcrew_message_agent',
  invoke: 'pitchcrew_invoke_agent',
  propose: 'pitchcrew_propose_role_changes',
  workflow: 'pitchcrew_change_workflow',
  jobs: 'pitchcrew_list_jobs',
  delete_job: 'pitchcrew_delete_job',
  bulk_move_jobs: 'pitchcrew_bulk_move_jobs',
  bulk_delete_jobs: 'pitchcrew_bulk_delete_jobs',
  propose_skill: 'pitchcrew_propose_skill',
  conversations: 'pitchcrew_list_conversations',
  conversation_messages: 'pitchcrew_read_conversation',
  create_group: 'pitchcrew_create_group',
  invite_agent: 'pitchcrew_invite_agent',
  transfer_lead: 'pitchcrew_transfer_lead',
  recall_memory: 'pitchcrew_recall_memory',
  save_memory: 'pitchcrew_save_memory',
  card: 'pitchcrew_get_card',
  profile: 'pitchcrew_read_profile',
  history: 'pitchcrew_get_history',
  lint: 'pitchcrew_lint_packet',
  packet_rules: 'pitchcrew_get_packet_rules',
  export: 'pitchcrew_export_packet',
  computer_inspect: 'pitchcrew_computer_inspect',
  computer_request: 'pitchcrew_computer_request',
  computer_execute: 'pitchcrew_computer_execute',
  assess_form: 'pitchcrew_assess_form',
  capture_submission: 'pitchcrew_capture_submission',
  applications: 'pitchcrew_search_applications',
  application_insights: 'pitchcrew_application_insights',
  tracking_scan: 'pitchcrew_scan_application_mail',
  tracking_reconcile: 'pitchcrew_reconcile_application_mail',
  read_pipeline: 'pitchcrew_read_pipeline',
  save_pipeline_review: 'pitchcrew_save_pipeline_review',
  update_pipeline_review: 'pitchcrew_update_pipeline_review',
  propose_crew_changes: 'pitchcrew_propose_crew_changes',
  watched_profile_sources: 'pitchcrew_list_watched_profile_sources',
  detect_profile_changes: 'pitchcrew_detect_profile_changes',
  read_project_watch_file: 'pitchcrew_read_project_watch_file',
  propose_profile_note: 'pitchcrew_propose_profile_note',
  job_sources: 'pitchcrew_list_job_sources',
  scan_job_sources: 'pitchcrew_scan_job_sources',
  import_job_link: 'pitchcrew_import_job_link',
  routines: 'pitchcrew_list_routines',
  save_routine: 'pitchcrew_save_routine',
  delete_routine: 'pitchcrew_delete_routine',
});

export const mcpConnectorTools = Object.freeze([
  'github_get_revision',
  'github_search_repositories',
  'github_list_repositories',
  'github_get_profile',
  'github_search_issues',
  'github_read_file',
  'gmail_search_messages',
  'gmail_get_message',
  'gmail_get_thread',
  'google_drive_search_files',
  'google_drive_get_file',
  'google_drive_read_text_file',
  'google_docs_get_document',
  'google_sheets_read_range',
  'google_calendar_list_events',
]);

const names = new Set<string>([...Object.values(mcpGatewayTools), ...mcpConnectorTools]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Shared by the local buffer and renderer; rebuild, never spread untrusted properties. */
export function sanitizeMcpToolCall(input: Record<string, unknown>) {
  if (
    typeof input.$mcp_tool_name !== 'string' ||
    !names.has(input.$mcp_tool_name) ||
    typeof input.$mcp_is_error !== 'boolean' ||
    typeof input.$mcp_duration_ms !== 'number' ||
    !Number.isFinite(input.$mcp_duration_ms) ||
    input.$mcp_duration_ms < 0 ||
    input.$mcp_duration_ms > 1_800_000 ||
    typeof input.$mcp_session_id !== 'string' ||
    !uuid.test(input.$mcp_session_id)
  )
    return null;
  return {
    $mcp_tool_name: input.$mcp_tool_name,
    $mcp_is_error: input.$mcp_is_error,
    $mcp_duration_ms: Math.round(input.$mcp_duration_ms),
    $mcp_server_name: 'pitchcrew',
    $mcp_session_id: input.$mcp_session_id,
    $session_id: input.$mcp_session_id,
    mcp_observation_level: 'scoped_gateway',
  };
}
