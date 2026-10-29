import { agentProblemAreas } from '@pitchcrew/core/telemetry-errors';
import { z } from 'zod';
import type { CrewContext, RunCapability } from '../types.ts';

// Capability objects expire with their runs. At most one report per fixed area survives a retry.
const reports = new WeakMap<RunCapability, Set<string>>();

export const reportTechnicalProblem = (
  context: CrewContext,
  capability: RunCapability,
  data: unknown,
) => {
  const { area } = z
    .object({ area: z.enum(agentProblemAreas) })
    .strict()
    .parse(data);
  const seen = reports.get(capability) ?? new Set<string>();
  if (seen.has(area)) return { ok: true, duplicate: true };
  seen.add(area);
  reports.set(capability, seen);
  try {
    context.diagnostics?.record('$exception', {
      error_source: 'agent_report',
      error_category: 'technical_problem',
      error_area: area,
    });
  } catch {
    // Reporting must never become another blocker, even when the diagnostic sink fails.
  }
  return { ok: true, duplicate: false };
};
