import type { Role, Run } from '@pitchcrew/core';
import type { CrewContext, RunCapability } from '../types.ts';

/** Agent scans of a source wait this long after its last successful scan. */
export const agentScanIntervalMs = 15 * 60 * 1000;

/**
 * Agents may scan the user's saved sources and read their names and filters. There is no agent
 * path to add, edit or remove a source, or to fetch any other URL.
 */
export async function jobSourceAction(
  this: CrewContext,
  capability: RunCapability,
  token: string,
  action: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const authorize = () => {
    const role = this.board.get<Role>('role', capability.roleId);
    const signal = this.controllers.get(capability.runId)?.signal;
    if (
      this.closing ||
      this.capabilities.get(token) !== capability ||
      !signal ||
      signal.aborted ||
      this.board.get<Run>('run', capability.runId).status !== 'running' ||
      !role.enabled ||
      role.retiredAt ||
      role.capabilities?.discoverJobs !== true
    )
      throw new Error('Job discovery is disabled for your role or this run has ended.');
    return signal;
  };
  const signal = authorize();
  if (action === 'job_sources')
    return {
      sources: (await this.jobSources.list()).map(
        ({ id, name, provider, enabled, filters, lastScan }) => ({
          id,
          name,
          provider,
          enabled,
          filters,
          lastScan,
        }),
      ),
    };
  const summary = await this.jobSources.scan({
    actor: capability.roleId,
    input: data.input ?? {},
    signal,
    recentMs: agentScanIntervalMs,
  });
  return { summary };
}
