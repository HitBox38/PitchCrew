import type {
  ImportedProfileFile,
  ProfileFile,
  ProfileSource,
  ProfileSourcePreview,
} from '@pitchcrew/core';
import type { ConnectorManager } from '@pitchcrew/mcp/connectors';
import { readProfile } from '@pitchcrew/packet';
import { randomUUID } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
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
  async preview(value: unknown): Promise<ProfileSourcePreview> {
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
      const signal = AbortSignal.timeout(120000);
      const remote =
        input.provider === 'github'
          ? await readGithubSource(this.connectors, input, signal)
          : await readDriveSource(this.connectors, input, signal);
      checkFiles(remote.files);
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
      const source: ProfileSource = {
        id,
        input,
        label: remote.label,
        importedAt: new Date().toISOString(),
        files: [],
      };
      const preview: ProfileSourcePreview = {
        token: randomUUID(),
        source,
        files,
        missing: (previous?.files ?? [])
          .filter((old) => !files.some((file) => file.key === old.key))
          .map((old) => old.path),
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
