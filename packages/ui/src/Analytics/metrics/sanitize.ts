const duration = (input: unknown) => {
  return typeof input === 'number' &&
    Number.isFinite(input) &&
    input >= 0 &&
    input <= durationLimitMs
    ? Math.round(input)
    : undefined;
};

export const sanitizeRequestMetric = (
  input: Record<string, unknown>,
): Record<string, string | number> | null => {
  const duration_ms = duration(input.duration_ms);
  if (
    !metricOperations.includes(input.operation as never) ||
    !requestResults.includes(input.result as never) ||
    duration_ms === undefined
  )
    return null;
  const properties: Record<string, string | number> = {
    operation: input.operation as string,
    result: input.result as string,
    duration_ms,
  };
  if (
    Number.isInteger(input.http_status) &&
    (input.http_status as number) >= 100 &&
    (input.http_status as number) <= 599
  )
    properties.http_status = input.http_status as number;
  return properties;
};

export const sanitizeRunMetric = (
  input: Record<string, unknown>,
): Record<string, string | number> | null => {
  if (
    !runOutcomes.includes(input.outcome as never) ||
    !['workflow', 'chat'].includes(input.mode as string)
  )
    return null;
  const properties: Record<string, string | number> = {
    outcome: input.outcome as string,
    mode: input.mode as string,
  };
  // Missing or invalid timestamps must not look like a zero-duration run.
  const duration_ms = duration(input.duration_ms);
  if (duration_ms !== undefined) properties.duration_ms = duration_ms;
  return properties;
};
export const metricOperations = [
  'job_created',
  'application_registered',
  'applications_imported',
  'application_status_changed',
  'workflow_started',
  'chat_sent',
  'conversation_created',
  'chat_continued',
  'user_question_answered',
  'user_question_cancelled',
  'browser_session_changed',
  'pipeline_followup_saved',
  'agent_created',
  'agent_saved',
  'agent_retired',
  'agent_restored',
  'skill_saved',
  'skill_deleted',
  'routine_saved',
  'routine_deleted',
  'profile_saved',
  'job_sources_scanned',
  'packet_export_requested',
  'approval_decided',
  'packet_exported',
  'onboarding_updated',
] as const;
export const requestResults = [
  'success',
  'http_error',
  'network_error',
  'invalid_response',
  'aborted',
] as const;
export const runOutcomes = ['completed', 'failed', 'cancelled'] as const;
export const durationLimitMs = 24 * 60 * 60 * 1000;
