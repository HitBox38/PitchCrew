import { agentProblemInput, sanitizeAgentProblem } from '@pitchcrew/core/telemetry-errors';
import type { CrewContext, RunCapability } from '../types.ts';

// Capability objects expire with their runs. Exact duplicates and report volume are bounded.
const reports = new WeakMap<RunCapability, Set<string>>();

export const reportTechnicalProblem = (
  context: CrewContext,
  capability: RunCapability,
  data: unknown,
) => {
  const input = agentProblemInput.parse(data);
  const properties = sanitizeAgentProblem({
    error_source: 'agent_report',
    error_category: 'technical_problem',
    error_area: input.area,
    error_kind: input.kind,
    error_summary: input.summary,
    error_expected: input.expected,
    error_actual: input.actual,
    error_steps: input.steps,
    error_workaround: input.workaround,
    error_tool: input.tool,
  })!;
  const identity = JSON.stringify(properties);
  const seen = reports.get(capability) ?? new Set<string>();
  if (seen.has(identity)) return { ok: true, duplicate: true };
  if (seen.size >= 8) return { ok: true, duplicate: false, limited: true };
  seen.add(identity);
  reports.set(capability, seen);
  try {
    context.diagnostics?.record('$exception', properties);
  } catch {
    // Reporting must never become another blocker, even when the diagnostic sink fails.
  }
  return { ok: true, duplicate: false };
};
