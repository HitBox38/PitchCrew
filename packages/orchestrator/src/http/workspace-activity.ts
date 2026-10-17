import type { Run } from '@pitchcrew/core';
import type { CrewService } from '../service.ts';

/** Each stream sends active runs and their final saved state once, without replaying old activity. */
export function createWorkspaceActivity(service: CrewService) {
  let previous = new Set<string>();
  return (live: Run[]): Run[] => {
    const saved = service.board.db
      .prepare(`SELECT json_remove(json,'$.configuration') AS json
      FROM entities WHERE kind='run' AND json_extract(json,'$.mode')='chat'
      AND json_extract(json,'$.status')='running' ORDER BY rowid`)
      .all() as { json: string }[];
    const runs = new Map(
      saved.map((row) => {
        const run = JSON.parse(row.json) as Run;
        return [run.id, run] as const;
      }),
    );
    for (const run of live) runs.set(run.id, run);
    for (const id of previous)
      if (!runs.has(id)) {
        const { configuration: _configuration, ...run } = service.board.get<Run>('run', id);
        runs.set(id, run);
      }
    previous = new Set(
      [...runs.values()].filter((run) => run.status === 'running').map((run) => run.id),
    );
    return [...runs.values()];
  };
}
