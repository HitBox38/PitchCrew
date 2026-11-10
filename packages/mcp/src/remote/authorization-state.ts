import { randomBytes } from 'node:crypto';
import { mkdir, open, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

export const readScope = 'pitchcrew:read';
export const writeScope = 'pitchcrew:write';
export const oauthScope = 'pitchcrew:access';
export type RemoteScope = typeof readScope | typeof writeScope;
export const grantLifetime = 30 * 24 * 60 * 60 * 1000;
export const clientSchema = z
  .object({
    client_id: z.uuid(),
    client_id_issued_at: z.number().int().nonnegative(),
    client_name: z.string().min(1).max(80),
    redirect_uris: z.array(z.string().min(1).max(2048)).min(1).max(8),
    token_endpoint_auth_method: z.literal('none'),
    grant_types: z.tuple([z.literal('authorization_code'), z.literal('refresh_token')]),
    response_types: z.tuple([z.literal('code')]),
    scope: z.literal(oauthScope),
  })
  .strict();
const scopesSchema = z
  .array(z.enum([readScope, writeScope]))
  .min(1)
  .max(2);
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const timeSchema = z.number().int().positive();
export const stateSchema = z
  .object({
    version: z.literal(1),
    clients: z.array(z.object({ info: clientSchema, expiresAt: timeSchema }).strict()).max(100),
    grants: z
      .array(
        z
          .object({
            id: z.uuid(),
            clientId: z.uuid(),
            name: z.string().min(1).max(80),
            resource: z.string().url().max(2048),
            scopes: scopesSchema,
            createdAt: timeSchema,
            expiresAt: timeSchema,
            lastUsedAt: timeSchema.optional(),
            accessHash: digestSchema,
            accessExpiresAt: timeSchema,
            refreshHash: digestSchema,
          })
          .strict(),
      )
      .max(50),
  })
  .strict();
export type AuthorizationState = z.infer<typeof stateSchema>;
export type RegisteredClient = z.infer<typeof clientSchema>;
export type StoredGrant = AuthorizationState['grants'][number];
const maximumBytes = 512 * 1024;
const fileName = 'remote-mcp.json';

export const readAuthorizationState = async (directory: string): Promise<AuthorizationState> => {
  try {
    const file = await open(join(directory, fileName), 'r');
    let raw: string;
    try {
      const buffer = Buffer.alloc(maximumBytes + 1);
      let length = 0;
      while (length < buffer.length) {
        const result = await file.read(buffer, length, buffer.length - length, length);
        if (!result.bytesRead) break;
        length += result.bytesRead;
      }
      if (length > maximumBytes) throw new Error('File too large.');
      raw = buffer.subarray(0, length).toString('utf8');
    } finally {
      await file.close();
    }
    return stateSchema.parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return { version: 1, clients: [], grants: [] };
    throw new Error(
      'Remote app access file is unreadable. Restore remote-mcp.json before starting a connection.',
    );
  }
};

export const writeAuthorizationState = async (directory: string, state: AuthorizationState) => {
  const body = JSON.stringify(stateSchema.parse(state));
  if (Buffer.byteLength(body) > maximumBytes)
    throw new Error(
      'Remote app access storage is full. Revoke unused apps before connecting another.',
    );
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = join(directory, `.remote-mcp-${randomBytes(16).toString('hex')}.tmp`);
  try {
    await writeFile(temporary, body, { mode: 0o600, flag: 'wx' });
    await rename(temporary, join(directory, fileName));
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
};
