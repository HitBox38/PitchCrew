import { createHash } from 'node:crypto';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { CrewContext } from './types.ts';

/** Match readProfile's inputs without reading note contents or the board's large projections. */
async function profileRevision(directory: string) {
  const path = join(directory, 'profile');
  const files = await readdir(path).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const names = files.filter((name) => /^[\w.-]+\.md$/.test(name)).sort();
  return Promise.all(
    names.map(async (name) => {
      const info = await stat(join(path, name));
      return [name, info.ino, info.size, info.mtimeMs, info.ctimeMs];
    }),
  );
}

/**
 * Every snapshot input outside SQLite belongs here. Compare values rather than mutation hooks:
 * connector transitions, runtime discovery, file edits and live activity have no board event.
 * SQLite's two counters cover writes both on this connection and on other connections.
 */
export async function snapshotRevision(context: CrewContext): Promise<string> {
  const profile = await profileRevision(context.directory);
  const revision = {
    database: context.board.db.prepare('SELECT total_changes() AS changes').get(),
    externalDatabase: context.board.db.pragma('data_version', { simple: true }),
    profile,
    onboarding: context.onboarding.get(),
    packetRules: context.packetRules.current(),
    instructionUpdates: context.instructionUpdatePreferences.dismissed(),
    skillUpdates: context.skillUpdateChecks.revision(),
    profileOrganization: context.profileOrganization.get(),
    runtimes: context.runtimes,
    runtimeMaintenance: context.runtimeMaintenance.revision(),
    connectors: context.connectors.status(),
    starterSkillErrors: context.starterSkillErrors,
    streamingMessages: [...context.streamingMessages.values()],
    activity: [...context.runActivities],
  };
  return createHash('sha256').update(JSON.stringify(revision)).digest('hex');
}
