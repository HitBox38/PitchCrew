import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { z } from 'zod';
import { detectorProviders, type DetectorProvider, type DetectorStatus } from '@pitchcrew/core';

const storedKey = z.object({
  key: z.string().min(1),
  email: z.email().optional(),
  savedAt: z.string(),
});
const storeSchema = z.object({
  version: z.literal(1),
  providers: z.record(z.string(), storedKey).default({}),
});
export type StoredDetectorKey = z.infer<typeof storedKey>;
type Store = Omit<z.infer<typeof storeSchema>, 'providers'> & {
  providers: Partial<Record<DetectorProvider, StoredDetectorKey>>;
};

/**
 * User-supplied detector credentials. They live in `detectors/keys.json` beside the connector
 * credentials, never in board events, snapshots, prompts, run folders or MCP configuration.
 */
export class DetectorKeyStore {
  private store: Store = { version: 1, providers: {} };
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly directory: string) {}
  private get folder() {
    return join(this.directory, 'detectors');
  }
  private get file() {
    return join(this.folder, 'keys.json');
  }
  initialize = async () => {
    try {
      this.store = storeSchema.parse(JSON.parse(await readFile(this.file, 'utf8'))) as Store;
      await chmod(this.file, 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw new Error(
          'Cannot read detector keys. Restore or remove the detectors/keys.json file in your data directory.',
        );
    }
  };
  /** Saved status only; the key itself never leaves this store. */
  status = (): DetectorStatus[] =>
    detectorProviders.map((provider) => {
      const saved = this.store.providers[provider];
      return saved
        ? { provider, configured: true, savedAt: saved.savedAt }
        : { provider, configured: false };
    });
  revision = () => JSON.stringify(this.status());
  get = (provider: DetectorProvider): StoredDetectorKey | undefined =>
    this.store.providers[provider];
  set = (provider: DetectorProvider, input: { key: string; email?: string }) =>
    this.mutate((store) => {
      store.providers[provider] = { ...input, savedAt: new Date().toISOString() };
    });
  remove = (provider: DetectorProvider) =>
    this.mutate((store) => {
      delete store.providers[provider];
    });
  private mutate = (change: (store: Store) => void) => {
    const next = this.queue.then(async () => {
      const store = structuredClone(this.store);
      change(store);
      await mkdir(this.folder, { recursive: true, mode: 0o700 });
      await chmod(this.folder, 0o700);
      const temporary = join(this.folder, `${randomUUID()}.tmp`);
      try {
        await writeFile(temporary, JSON.stringify(store), { mode: 0o600, flag: 'wx' });
        await rename(temporary, this.file);
        await chmod(this.file, 0o600);
      } finally {
        await rm(temporary, { force: true });
      }
      this.store = store;
      return this.status();
    });
    this.queue = next.catch(() => {});
    return next;
  };
}
