import type {
  ImportedProfileFile,
  ProfileFile,
  ProfileSource,
  ProfileSourcePreview,
  ProfileMaintenanceProposal,
} from '@pitchcrew/core';
import type { ConnectorManager } from '@pitchcrew/mcp/connectors';
import { readProfile } from '@pitchcrew/packet';
import { randomUUID } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { readDriveSource } from './drive.ts';
import { readGithubSource } from './github.ts';
import { checkFiles, digest, localName, sourceId, sourceInput } from './helpers.ts';

const storedFile = z.object({
  key: z.string(),
  name: z
    .string()
    .regex(/^[\w.-]+\.md$/)
    .refine((v) => !v.includes('..')),
  path: z.string(),
  url: z.string(),
  revision: z.string(),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
});
const storedSources = z.array(
  z.object({
    id: z.string(),
    input: sourceInput,
    label: z.string(),
    importedAt: z.string(),
    watching: z.boolean().optional(),
    missingFiles: z.array(z.string()).max(100).optional(),
    mode: z.literal('project').optional(),
    revision: z
      .string()
      .regex(/^[a-f0-9]{40}$/)
      .optional(),
    files: z.array(storedFile),
  }),
);
interface Staged {
  preview: ProfileSourcePreview;
  before: Map<string, string | null>;
  sourcesDigest: string;
}
export class ProfileSourceManager {
  private previews = new Map<string, Staged>();
  private previewing = false;
  constructor(
    readonly directory: string,
    readonly connectors: ConnectorManager,
  ) {}
  private get manifest() {
    return join(this.directory, 'profile-sources.json');
  }
  async list(): Promise<ProfileSource[]> {
    try {
      return storedSources.parse(JSON.parse(await readFile(this.manifest, 'utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }
  private async store(sources: ProfileSource[]) {
    const temporary = `${this.manifest}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(sources, null, 2), { mode: 0o600 });
      await rename(temporary, this.manifest);
    } finally {
      await rm(temporary, { force: true });
    }
  }
  async unlink(id: string) {
    const sources = await this.list();
    if (!sources.some((source) => source.id === id)) throw new Error('Profile source not found.');
    await this.store(sources.filter((source) => source.id !== id));
  }
  async watchProject(value: unknown) {
    const input = sourceInput.parse(value);
    if (input.provider !== 'github')
      throw new Error('Project watches currently support GitHub repositories.');
    const id = digest('project:' + JSON.stringify(input)).slice(0, 24);
    const sources = await this.list();
    if (sources.some((source) => source.id === id))
      throw new Error('This project is already watched.');
    if (sources.length >= 20) throw new Error('Keep at most 20 profile sources.');
    const [owner, repo] = input.repository.split('/');
    const result = await this.connectors.call(
      'github_get_revision',
      { owner, repo, ref: input.ref },
      AbortSignal.timeout(120000),
    );
    const revision = z
      .string()
      .regex(/^[a-f0-9]{40}$/)
      .parse(result.sha);
    const source: ProfileSource = {
      id,
      input,
      label: `${input.repository}/${input.path}`,
      importedAt: new Date().toISOString(),
      watching: true,
      mode: 'project',
      revision,
      files: [],
    };
    await this.store([...sources, source]);
    return this.list();
  }
  async setWatching(id: string, watching: boolean) {
    const sources = await this.list();
    if (!sources.some((source) => source.id === id)) throw new Error('Profile source not found.');
    await this.store(
      sources.map((source) => (source.id === id ? { ...source, watching } : source)),
    );
    return this.list();
  }
  async preview(
    value: unknown,
    runSignal?: AbortSignal,
    allowEmpty = false,
  ): Promise<ProfileSourcePreview> {
    if (this.previewing) throw new Error('Wait for the current source preview to finish.');
    const input = sourceInput.parse(value);
    this.previewing = true;
    try {
      for (const [token, staged] of this.previews)
        if (Date.parse(staged.preview.expiresAt) <= Date.now()) this.previews.delete(token);
      if (this.previews.size >= 3) this.previews.delete(this.previews.keys().next().value!);
      const sources = await this.list();
      const id = sourceId(input);
      const previous = sources.find((source) => source.id === id);
      const timeout = AbortSignal.timeout(120000);
      const signal = runSignal ? AbortSignal.any([timeout, runSignal]) : timeout;
      const remote =
        input.provider === 'github'
          ? await readGithubSource(this.connectors, input, signal)
          : await readDriveSource(this.connectors, input, signal);
      if (remote.files.length || !allowEmpty) checkFiles(remote.files);
      const local = await readProfile(this.directory);
      const before = new Map<string, string | null>();
      const files = remote.files.map((file) => {
        const old = previous?.files.find((prior) => prior.key === file.key);
        const name = old?.name ?? localName(id, file.key, file.path);
        const existing = local.find((note) => note.name === name);
        const currentDigest = existing ? digest(existing.content) : null;
        const incomingDigest = digest(file.content);
        before.set(name, currentDigest);
        const status =
          currentDigest && currentDigest !== old?.digest && currentDigest !== incomingDigest
            ? ('conflict' as const)
            : !existing
              ? ('new' as const)
              : currentDigest === incomingDigest
                ? ('unchanged' as const)
                : ('changed' as const);
        return { ...file, name, digest: incomingDigest, status };
      });
      const missing = (previous?.files ?? [])
        .filter((old) => !files.some((file) => file.key === old.key))
        .map((old) => old.path);
      const source: ProfileSource = {
        id,
        input,
        label: remote.label,
        importedAt: new Date().toISOString(),
        watching: previous?.watching ?? false,
        missingFiles: missing,
        files: [],
      };
      const preview: ProfileSourcePreview = {
        token: randomUUID(),
        source,
        files,
        missing,
        expiresAt: new Date(Date.now() + 10 * 60000).toISOString(),
      };
      this.previews.set(preview.token, {
        preview,
        before,
        sourcesDigest: digest(JSON.stringify(sources)),
      });
      return preview;
    } finally {
      this.previewing = false;
    }
  }
  async import(value: unknown): Promise<ProfileFile[]> {
    const { token, names } = z
      .object({ token: z.uuid(), names: z.array(z.string()).min(1).max(100) })
      .strict()
      .parse(value);
    const staged = this.previews.get(token);
    if (!staged || Date.parse(staged.preview.expiresAt) <= Date.now())
      throw new Error('This preview expired. Load the source again.');
    const selected = staged.preview.files.filter((file) => names.includes(file.name));
    if (selected.length !== new Set(names).size)
      throw new Error('Select only files from this preview.');
    const sources = await this.list();
    if (digest(JSON.stringify(sources)) !== staged.sourcesDigest)
      throw new Error('Profile sources changed. Load a fresh preview.');
    const local = await readProfile(this.directory);
    for (const file of selected) {
      const existing = local.find((note) => note.name === file.name);
      if ((existing ? digest(existing.content) : null) !== staged.before.get(file.name))
        throw new Error(
          'A profile note changed after preview. Load the source again before replacing it.',
        );
    }
    const previous = sources.find((source) => source.id === staged.preview.source.id);
    const records: ImportedProfileFile[] = [...(previous?.files ?? [])];
    for (const file of selected) {
      const { content: _content, status: _status, ...record } = file;
      const index = records.findIndex((prior) => prior.name === file.name);
      if (index < 0) records.push(record);
      else records[index] = record;
    }
    const source = {
      ...staged.preview.source,
      importedAt: new Date().toISOString(),
      files: records,
    };
    const updated = [...sources.filter((prior) => prior.id !== source.id), source];
    if (updated.length > 20)
      throw new Error('Keep at most 20 profile sources. Remove an old connection first.');
    // Each note replacement is atomic; restore prior copies if committing the batch fails.
    const changed: typeof selected = [];
    try {
      for (const file of selected) {
        changed.push(file);
        await this.writeNote(file.name, file.content);
      }
      await this.store(updated);
    } catch (error) {
      for (const file of changed) {
        const original = local.find((note) => note.name === file.name);
        if (original) await this.writeNote(file.name, original.content);
        else await rm(join(this.directory, 'profile', file.name), { force: true });
      }
      throw error;
    }
    this.previews.delete(token);
    return readProfile(this.directory);
  }
  async commitMaintenance(
    proposal: ProfileMaintenanceProposal,
    names: string[],
    recovering: boolean,
    validateOnly = false,
  ) {
    const sources = await this.list();
    const selected = proposal.documents.filter((file) => names.includes(file.name));
    if (selected.length !== new Set(names).size) throw new Error('Select only proposed files.');
    const prior = proposal.baseSources.find((source) => source.id === proposal.source.id)!;
    const records = [...prior.files];
    for (const file of selected) {
      const { content: _content, before: _before, status: _status, ...record } = file;
      const index = records.findIndex((item) => item.key === record.key);
      if (index < 0) records.push(record);
      else records[index] = record;
    }
    const updated = proposal.baseSources.map((source) =>
      source.id === prior.id
        ? {
            ...proposal.source,
            watching: true,
            files: records,
            importedAt: proposal.createdAt,
            ...(proposal.observation ? { revision: proposal.observation.current } : {}),
          }
        : source,
    );
    const manifestMatches = isDeepStrictEqual(sources, proposal.baseSources);
    const committedManifest = isDeepStrictEqual(sources, updated);
    if (!manifestMatches && !(recovering && committedManifest))
      throw new Error('Profile sources changed. Detect changes again before approving.');
    const local = await readProfile(this.directory);
    const expected = new Map(proposal.baseProfile.map((file) => [file.name, file.digest]));
    for (const note of local) {
      const incoming = selected.find((file) => file.name === note.name);
      if (
        digest(note.content) !== expected.get(note.name) &&
        !(recovering && incoming && digest(note.content) === incoming.digest)
      )
        throw new Error('Profile notes changed. Detect changes again before approving.');
      expected.delete(note.name);
    }
    if (expected.size)
      throw new Error('Profile notes were removed. Detect changes again before approving.');
    if (validateOnly) return;
    const changed: typeof selected = [];
    try {
      for (const file of selected) {
        changed.push(file);
        await this.writeNote(file.name, file.content);
      }
      await this.store(updated);
    } catch (error) {
      for (const file of changed) {
        const old = local.find((note) => note.name === file.name);
        if (old) await this.writeNote(file.name, old.content);
        else await rm(join(this.directory, 'profile', file.name), { force: true });
      }
      throw error;
    }
  }
  private async writeNote(name: string, content: string) {
    const target = join(this.directory, 'profile', name);
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, content, 'utf8');
      await rename(temporary, target);
    } finally {
      await rm(temporary, { force: true });
    }
  }
}
