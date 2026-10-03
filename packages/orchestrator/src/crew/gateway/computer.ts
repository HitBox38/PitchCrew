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
  const authorize = (feature?: 'assessForms' | 'recordSubmissions') => {
    const run = this.board.get<Run>('run', capability.runId);
    const current = this.board.get<Role>('role', capability.roleId);
    if (
      !this.capabilities.has(token) ||
      this.controllers.get(capability.runId)?.signal.aborted ||
      this.closing ||
      run.status !== 'running' ||
      !current.enabled ||
      current.capabilities?.computerUse !== true ||
      (feature !== undefined && current.capabilities?.[feature] !== true)
    )
      throw new Error('Computer use is disabled or the run has ended.');
  };
  authorize();
  if (action === 'assess_form' || action === 'capture_submission') {
    const current = this.board.get<Role>('role', capability.roleId);
    if (action === 'assess_form') {
      if (current.capabilities?.assessForms !== true)
        throw new Error('Form assessment is disabled.');
      const assessment = await this.computer.assess(capability, data.input, () =>
        authorize('assessForms'),
      );
      authorize();
      return { assessment };
    }
    if (current.capabilities?.recordSubmissions !== true)
      throw new Error('Submission recording is disabled.');
    const input = z
      .object({ id: z.uuid(), evidence: z.string().min(1).max(2000) })
      .parse(data.input);
    const attempt = await this.computer.capture(capability, input.id, input.evidence, () =>
      authorize('recordSubmissions'),
    );
    authorize();
    return { attempt };
  }
  if (action === 'computer_inspect') return { page: await this.computer.inspect(capability.runId) };
  if (action === 'computer_request') {
    const input = z
      .object({ input: z.unknown(), reason: z.string().trim().min(1).max(2000) })
      .parse(data);
    if (
      input.input &&
      typeof input.input === 'object' &&
      (('purpose' in input.input && input.input.purpose === 'submission') ||
        ('submissionAttemptId' in input.input && !!input.input.submissionAttemptId)) &&
      this.board.get<Role>('role', capability.roleId).capabilities?.recordSubmissions !== true
    )
      throw new Error('Submission recording is disabled.');
    return { approval: await this.computer.request(capability, input.input, input.reason) };
  }
  const id = z.uuid().parse(data.approvalId);
  const approval = this.board.get<import('@pitchcrew/core').ComputerApproval>(
    'computer_approval',
    id,
  );
  if (
    (('purpose' in approval.action && approval.action.purpose === 'submission') ||
      ('submissionAttemptId' in approval.action && !!approval.action.submissionAttemptId)) &&
    this.board.get<Role>('role', capability.roleId).capabilities?.recordSubmissions !== true
  )
    throw new Error('Submission recording is disabled.');
  return this.computer.execute(
    capability.runId,
    id,
    this.controllers.get(capability.runId)?.signal ?? new AbortController().signal,
    () =>
      authorize(
        ('purpose' in approval.action && approval.action.purpose === 'submission') ||
          ('submissionAttemptId' in approval.action && !!approval.action.submissionAttemptId)
          ? 'recordSubmissions'
          : undefined,
      ),
  );
}
