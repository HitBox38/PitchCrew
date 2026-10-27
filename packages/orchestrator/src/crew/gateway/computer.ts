import { type Role, type Run, type Conversation } from '@pitchcrew/core';
import { z } from 'zod';
import type { CrewContext, RunCapability } from '../types.ts';

export const computerAction = async (
  context: CrewContext,
  capability: RunCapability,
  token: string,
  action: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const authorize = (feature?: 'assessForms' | 'recordSubmissions') => {
    const run = context.board.get<Run>('run', capability.runId);
    const current = context.board.get<Role>('role', capability.roleId);
    if (
      !context.capabilities.has(token) ||
      context.controllers.get(capability.runId)?.signal.aborted ||
      context.closing ||
      run.status !== 'running' ||
      !current.enabled ||
      current.capabilities?.computerUse !== true ||
      (feature !== undefined && current.capabilities?.[feature] !== true)
    )
      throw new Error('Computer use is disabled or the run has ended.');
  };
  authorize();
  const active = context.board.get<Run>('run', capability.runId);
  const root = context.board
    .list<Run>('run')
    .find((run) => run.id === (active.rootRunId ?? active.id));
  const role = active.configuration?.role ?? context.board.get<Role>('role', capability.roleId);
  const conversation = active.threadId
    ? context.board.list<Conversation>('conversation').find((item) => item.id === active.threadId)
    : undefined;
  context.computer.bindBrowser({
    ...capability,
    threadId: active.threadId,
    taskId: root?.id ?? active.id,
    mode:
      active.routineId || root?.routineId || conversation?.kind === 'routine'
        ? 'supervised'
        : active.configuration
          ? (role.browserMode ?? 'supervised')
          : (conversation?.configurations[role.id]?.browserMode ??
            role.browserMode ??
            'supervised'),
  });
  const deadline = Date.now() + 30_000;
  while (context.computer.browsers.forRun(capability.runId)?.info.manual && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    authorize();
  }
  if (context.computer.browsers.forRun(capability.runId)?.info.manual)
    return {
      status: 'manual',
      message:
        'The user has browser control. Call computer_inspect again to wait. Keep the run alive; do not inspect or act while the user controls it.',
    };
  if (action === 'assess_form' || action === 'capture_submission') {
    const current = context.board.get<Role>('role', capability.roleId);
    if (action === 'assess_form') {
      if (current.capabilities?.assessForms !== true)
        throw new Error('Form assessment is disabled.');
      const assessment = await context.computer.assess(capability, data.input, () =>
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
    const attempt = await context.computer.capture(capability, input.id, input.evidence, () =>
      authorize('recordSubmissions'),
    );
    authorize();
    return { attempt };
  }
  if (action === 'computer_tabs') {
    const result = await context.computer.tabs(capability.runId, data.input);
    authorize();
    return result;
  }
  if (action === 'computer_wait')
    return context.computer.wait(
      capability.runId,
      data.input,
      context.controllers.get(capability.runId)?.signal ?? new AbortController().signal,
      authorize,
    );
  if (action === 'computer_inspect') {
    const options = z
      .object({
        includeImage: z.boolean().default(false),
        tabId: z.string().min(1).max(100).optional(),
      })
      .parse(data);
    const page = await context.computer.inspect(capability.runId, { ...options, references: true });
    authorize();
    return { page };
  }
  if (action === 'computer_request') {
    const input = z
      .object({ input: z.unknown(), reason: z.string().trim().min(1).max(2000) })
      .parse(data);
    if (
      input.input &&
      typeof input.input === 'object' &&
      (('purpose' in input.input && input.input.purpose === 'submission') ||
        ('submissionAttemptId' in input.input && !!input.input.submissionAttemptId)) &&
      context.board.get<Role>('role', capability.roleId).capabilities?.recordSubmissions !== true
    )
      throw new Error('Submission recording is disabled.');
    return { approval: await context.computer.request(capability, input.input, input.reason) };
  }
  const id = z.uuid().parse(data.approvalId);
  const approval = context.board.get<import('@pitchcrew/core').ComputerApproval>(
    'computer_approval',
    id,
  );
  if (
    (('purpose' in approval.action && approval.action.purpose === 'submission') ||
      ('submissionAttemptId' in approval.action && !!approval.action.submissionAttemptId)) &&
    context.board.get<Role>('role', capability.roleId).capabilities?.recordSubmissions !== true
  )
    throw new Error('Submission recording is disabled.');
  return context.computer.execute(
    capability.runId,
    id,
    context.controllers.get(capability.runId)?.signal ?? new AbortController().signal,
    () =>
      authorize(
        ('purpose' in approval.action && approval.action.purpose === 'submission') ||
          ('submissionAttemptId' in approval.action && !!approval.action.submissionAttemptId)
          ? 'recordSubmissions'
          : undefined,
      ),
  );
};
