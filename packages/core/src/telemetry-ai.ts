export const sanitizeAiObservation = (
  event: string,
  input: Record<string, unknown>,
): Properties | null => {
  if (!['$ai_trace', '$ai_span'].includes(event)) return null;
  if (typeof input.$ai_trace_id !== 'string' || !uuid.test(input.$ai_trace_id)) return null;
  if (!['workflow', 'chat'].includes(input.mode as string)) return null;
  if (!outcomes.includes(input.outcome as AiRunOutcome)) return null;
  if (
    typeof input.$ai_latency !== 'number' ||
    !Number.isFinite(input.$ai_latency) ||
    input.$ai_latency < 0 ||
    input.$ai_latency > 86_400
  )
    return null;
  const properties: Properties = {
    $ai_trace_id: input.$ai_trace_id,
    $ai_latency: Math.round(input.$ai_latency * 1000) / 1000,
    mode: input.mode as string,
    outcome: input.outcome as string,
    observation_level: 'runtime_boundary',
    $ai_is_error: input.outcome === 'failed',
  };
  if (event === '$ai_span') {
    if (typeof input.$ai_span_id !== 'string' || !uuid.test(input.$ai_span_id)) return null;
    if (input.$ai_parent_id !== input.$ai_trace_id) return null;
    properties.$ai_span_id = input.$ai_span_id;
    properties.$ai_parent_id = input.$ai_trace_id;
    properties.$ai_span_name = 'runtime_execution';
  } else properties.$ai_trace_name = input.mode === 'workflow' ? 'workflow_turn' : 'chat_turn';
  // Local relay metadata: convert to capture options.timestamp and strip before ingestion.
  if (
    Number.isSafeInteger(input.observed_start_ms) &&
    (input.observed_start_ms as number) >= 1_577_836_800_000 &&
    (input.observed_start_ms as number) <= 4_102_444_800_000
  )
    properties.observed_start_ms = input.observed_start_ms as number;
  return properties;
};
/** Shared closed vocabulary for manual AI traces. This module has no runtime/schema dependencies. */
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const outcomes = ['completed', 'failed', 'cancelled', 'waiting'] as const;
export type AiRunOutcome = (typeof outcomes)[number];
export type AiRunMode = 'workflow' | 'chat';
type Properties = Record<string, string | number | boolean>;

export const sanitizeAiTrace = (input: Record<string, unknown>) =>
  sanitizeAiObservation('$ai_trace', input);
export const sanitizeAiSpan = (input: Record<string, unknown>) =>
  sanitizeAiObservation('$ai_span', input);
