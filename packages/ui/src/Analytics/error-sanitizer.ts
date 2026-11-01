import { sanitizeAgentProblem } from '@pitchcrew/core/telemetry-errors';

/** Rebuild even already-encoded SDK payloads; never trust exception text or nested objects. */
export const sanitizeException = (
  input: Record<string, unknown>,
): Record<string, unknown> | null => {
  if (input.error_source === 'agent_report') {
    const problem = sanitizeAgentProblem(input);
    if (!problem) return null;
    const issue = `Pitchcrew agent technical problem: ${problem.error_area}`;
    return {
      ...problem,
      $exception_list: [
        {
          type: 'technical_problem',
          value: issue,
          mechanism: { type: 'agent_report', handled: true, synthetic: true },
        },
      ],
      $exception_fingerprint: `pitchcrew-v1:agent_report:technical_problem:${problem.error_area}`,
      $exception_level: 'error',
      $issue_name: issue,
    };
  }
  const source = input.error_source as ErrorSource;
  const category = input.error_category as ErrorCategory;
  if (!errorSources.includes(source) || !errorCategories.includes(category)) return null;
  const action = errorActions.includes(input.error_action as ErrorAction)
    ? (input.error_action as ErrorAction)
    : undefined;
  if (source === 'api_action' && !action) return null;
  const handled =
    source === 'react_boundary' || source === 'react_recoverable' || source === 'api_action';
  const issue = `Pitchcrew ${source}: ${category}${source === 'api_action' ? ` (${action})` : ''}`;
  return {
    error_source: source,
    error_category: category,
    ...(source === 'api_action' ? { error_action: action } : {}),
    $exception_list: [
      { type: category, value: issue, mechanism: { type: source, handled, synthetic: true } },
    ],
    $exception_fingerprint: `pitchcrew-v1:${source}:${category}${source === 'api_action' ? `:${action}` : ''}`,
    $exception_level: 'error',
    $issue_name: issue,
  };
};
export const errorSources = [
  'window_error',
  'unhandled_rejection',
  'react_boundary',
  'react_uncaught',
  'react_recoverable',
  'api_action',
] as const;
export type ErrorSource = (typeof errorSources)[number];

export const errorCategories = [
  'type_error',
  'reference_error',
  'range_error',
  'syntax_error',
  'uri_error',
  'evaluation_error',
  'generic_error',
  'non_error',
  'request_network',
  'request_server',
  'request_response',
] as const;
export type ErrorCategory = (typeof errorCategories)[number];

export const errorActions = [
  'chat',
  'workflow',
  'profile',
  'agent',
  'skill',
  'routine',
  'job',
  'application',
  'approval',
  'browser',
  'question',
  'pipeline',
  'onboarding',
] as const;
export type ErrorAction = (typeof errorActions)[number];
