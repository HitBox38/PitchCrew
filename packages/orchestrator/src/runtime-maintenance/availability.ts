import type { Role, Run, RuntimeId } from '@pitchcrew/core';
import type { CrewContext } from '../crew/types.ts';

export class RuntimeHeldError extends Error {}
export function runtimeBusyReasons(context: CrewContext, id: RuntimeId): string[] {
  const roles = new Map(context.board.list<Role>('role').map((role) => [role.id, role.name]));
  const running = context.board.db
    .prepare(
      "SELECT json_extract(json,'$.roleId') AS roleId, json_extract(json,'$.message') AS message FROM entities WHERE kind='run' AND json_extract(json,'$.runtime')=? AND json_extract(json,'$.status')='running'",
    )
    .all(id) as Pick<Run, 'roleId' | 'message'>[];
  const reasons = running.map((run) => `${roles.get(run.roleId) ?? run.roleId}: ${run.message}`);
  for (const review of context.deepReviewExecutions.values()) {
    const report = context.board.get<import('@pitchcrew/core').DeepReview>(
      'deep_review',
      review.id,
    );
    if (report.status !== 'running') continue;
    if (
      [
        review.writer.runtime,
        review.reviewer.runtime,
        ...report.options.alternatives.map((entry) => entry.runtime),
      ].includes(id)
    )
      reasons.push('A deep resume review is using this runtime.');
  }
  return [...new Set(reasons)].slice(0, 8);
}
