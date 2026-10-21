import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

const accessSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  write: z.boolean(),
});
export type ExternalAccess = z.infer<typeof accessSchema>;
const accessPath = (directory: string) => join(directory, 'external-mcp.json');

/** Read on every request so revocation and permission changes affect existing clients. */
export const readExternalAccess = async (directory: string): Promise<ExternalAccess | null> => {
  try {
    return accessSchema.parse(JSON.parse(await readFile(accessPath(directory), 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw new Error('External MCP access file is invalid. Run the MCP enable command again.');
  }
};

export const enableExternalAccess = async (directory: string, write = false): Promise<void> => {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = join(directory, `.external-mcp-${randomBytes(16).toString('hex')}.tmp`);
  try {
    await writeFile(temporary, JSON.stringify({ token: randomBytes(32).toString('hex'), write }), {
      mode: 0o600,
      flag: 'wx',
    });
    await rename(temporary, accessPath(directory));
  } finally {
    await rm(temporary, { force: true });
  }
};

export const disableExternalAccess = async (directory: string): Promise<void> => {
  await rm(accessPath(directory), { force: true });
};

export const authorizeExternalAccess = async (directory: string, authorization?: string) => {
  const access = await readExternalAccess(directory);
  const token = authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!access || !token || !timingSafeEqual(Buffer.from(token), Buffer.from(access.token)))
    return null;
  return access;
};
