import { type Role, type Run } from '@pitchcrew/core';
import { z } from 'zod';
import type { CrewContext, RunCapability } from '../types.ts';

export async function computerAction(
  this: CrewContext,
  capability: RunCapability,
  token: string,
  action: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const authorize = () => {
    const run = this.board.get<Run>('run', capability.runId);
    const current = this.board.get<Role>('role', capability.roleId);
    if (
      !this.capabilities.has(token) ||
      this.controllers.get(capability.runId)?.signal.aborted ||
      this.closing ||
      run.status !== 'running' ||
      !current.enabled ||
      current.capabilities?.computerUse !== true
    )
      throw new Error('Computer use is disabled or the run has ended.');
  };
  authorize();
  if (action === 'computer_inspect') return { page: await this.computer.inspect(capability.runId) };
  if (action === 'computer_request') {
    const input = z
      .object({ input: z.unknown(), reason: z.string().trim().min(1).max(2000) })
      .parse(data);
    return { approval: await this.computer.request(capability, input.input, input.reason) };
  }
  const id = z.uuid().parse(data.approvalId);
  return this.computer.execute(
    capability.runId,
    id,
    this.controllers.get(capability.runId)?.signal ?? new AbortController().signal,
    authorize,
  );
}
