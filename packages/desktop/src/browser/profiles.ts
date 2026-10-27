import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
const recordSchema = z.object({
  selectedId: z.string(),
  profiles: z
    .array(
      z.object({ id: z.union([z.literal('default'), z.uuid()]), name: z.string().min(1).max(60) }),
    )
    .min(1)
    .max(20),
});
const storeSchema = z.record(z.string().regex(/^[a-f0-9]{64}$/), recordSchema);
export const profilePartition = (base: string, id: string) =>
  id === 'default' ? base : createHash('sha256').update(`${base}:${id}`).digest('hex');
export const nativeProfiles = async (directory: string) => {
  const file = join(directory, 'browser-profile-names.json');
  let records: z.infer<typeof storeSchema> = {};
  try {
    records = storeSchema.parse(JSON.parse(await readFile(file, 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      throw new Error('Browser profile settings could not be read.');
  }
  let queue = Promise.resolve();
  const get = (base: string) =>
    records[base] ?? { selectedId: 'default', profiles: [{ id: 'default', name: 'Default' }] };
  return {
    get,
    partition: profilePartition,
    update: (base: string, change: (record: z.infer<typeof recordSchema>) => void) => {
      const result = queue.then(async () => {
        const next = structuredClone(get(base));
        change(next);
        recordSchema.parse(next);
        if (!next.profiles.some((profile) => profile.id === next.selectedId))
          throw new Error('Choose an existing browser profile.');
        const updated = { ...records, [base]: next };
        await mkdir(directory, { recursive: true, mode: 0o700 });
        const temporary = `${file}.${randomUUID()}.tmp`;
        await writeFile(temporary, JSON.stringify(updated), { mode: 0o600 });
        await rename(temporary, file);
        records = updated;
      });
      queue = result.catch(() => {});
      return result;
    },
  };
};
