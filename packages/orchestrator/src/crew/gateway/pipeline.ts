import { defaultCapabilities, type Role, type Run } from '@pitchcrew/core';
import type { CrewContext, RunCapability } from '../types.ts';
import { readPipeline } from '../pipeline/query.ts';
import { savePipelineReview, updatePipelineReview } from '../pipeline/reviews.ts';
import { proposeCrewChanges } from '../pipeline/proposals.ts';

export function pipelineAction(
  context: CrewContext,
  capability: RunCapability,
  action: string,
  input: unknown,
) {
  const run = context.board.get<Run>('run', capability.runId);
  const controller = context.controllers.get(capability.runId);
  if (context.closing || !controller || controller.signal.aborted || run.status !== 'running')
    throw new Error('The pipeline review run is invalid, completed or expired.');
  const role = context.board.get<Role>('role', capability.roleId);
  const permissions = role.capabilities ?? defaultCapabilities;
  if (!role.enabled || ('retiredAt' in role && role.retiredAt))
    throw new Error('This role is disabled or retired.');
  if (action === 'propose_crew_changes') {
    if (permissions.proposeCrewChanges !== true || permissions.reviewPipeline !== true)
      throw new Error('Crew change proposals and pipeline review are not enabled for this role.');
    return proposeCrewChanges(context, capability, input);
  }
  if (permissions.reviewPipeline !== true)
    throw new Error('Pipeline review is not enabled for this role.');
  if (action === 'read_pipeline') return readPipeline(context.board, input);
  if (action === 'save_pipeline_review') return savePipelineReview(context, capability, input);
  return updatePipelineReview(context, input, capability.roleId);
}
