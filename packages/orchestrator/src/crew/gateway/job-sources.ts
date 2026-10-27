import { jobLinkImportInput, type BrowserSnapshot, type Role, type Run } from '@pitchcrew/core';
import type { CrewContext, RunCapability } from '../types.ts';
import { computerAction } from './computer.ts';

/**
 * Agents may scan saved sources or read public job links. They cannot change saved sources.
 */
export const jobSourceAction = async (
  context: CrewContext,
  capability: RunCapability,
  token: string,
  action: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const authorize = () => {
    const role = context.board.get<Role>('role', capability.roleId);
    const signal = context.controllers.get(capability.runId)?.signal;
    if (
      context.closing ||
      context.capabilities.get(token) !== capability ||
      !signal ||
      signal.aborted ||
      context.board.get<Run>('run', capability.runId).status !== 'running' ||
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
      sources: (await context.jobSources.list()).map(
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
  if (action === 'import_job_link') {
    const input = jobLinkImportInput.parse(data.input);
    if (capability.cardId && input.cardId && capability.cardId !== input.cardId)
      throw new Error('Job link updates are scoped to the attached job.');
    const authorizeImport = () => {
      authorize();
      if (
        input.browserDigest &&
        context.board.get<Role>('role', capability.roleId).capabilities?.computerUse !== true
      )
        throw new Error(
          'Computer use is disabled. Enable browser tools in Crew to read this posting.',
        );
    };
    authorizeImport();
    return {
      result: await context.jobSources.importLink({
        actor: capability.roleId,
        input,
        runId: capability.runId,
        signal,
        authorize: authorizeImport,
        readBrowser: async () => {
          authorizeImport();
          const result = await computerAction(context, capability, token, 'computer_inspect', {});
          if (!result.page) throw new Error('Return browser control before reading the posting.');
          return result.page as BrowserSnapshot;
        },
      }),
    };
  }
  const summary = await context.jobSources.scan({
    actor: capability.roleId,
    input: data.input ?? {},
    signal,
    authorize,
    recentMs: agentScanIntervalMs,
  });
  return { summary };
};

/** Agent scans of a source wait this long after its last successful scan. */
export const agentScanIntervalMs = 15 * 60 * 1000;
