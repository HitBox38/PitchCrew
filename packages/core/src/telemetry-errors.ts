/** Fixed technical areas only; agent reports never accept free-form diagnostic content. */
export const agentProblemAreas = [
  'mcp',
  'browser',
  'runtime',
  'documents',
  'sources',
  'workspace',
  'other',
] as const;

/** Shared by the daemon buffer and renderer outbound boundary. */
export const sanitizeAgentProblem = (input: Record<string, unknown>) => {
  const area = input.error_area;
  if (
    input.error_source !== 'agent_report' ||
    input.error_category !== 'technical_problem' ||
    typeof area !== 'string' ||
    !agentProblemAreas.includes(area as (typeof agentProblemAreas)[number])
  )
    return null;
  return {
    error_source: 'agent_report',
    error_category: 'technical_problem',
    error_area: area,
  };
};
