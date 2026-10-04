import { z } from 'zod';

export const googleScopes = {
  gmail: 'https://www.googleapis.com/auth/gmail.readonly',
  drive: 'https://www.googleapis.com/auth/drive.readonly',
  calendar: 'https://www.googleapis.com/auth/calendar.readonly',
  sheets: 'https://www.googleapis.com/auth/spreadsheets.readonly',
};
export const googleTokenSchema = z.object({
  account: z.string(),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number(),
  scopes: z.array(z.string()),
  clientId: z.string().min(1),
  clientSecret: z.string(),
});
export const githubTokenSchema = z.union([
  z.object({ account: z.string(), accessToken: z.string().min(1) }),
  z.object({ account: z.string(), mode: z.literal('cli') }),
]);
export const storeSchema = z.object({
  version: z.literal(1),
  github: githubTokenSchema.optional(),
  google: googleTokenSchema.optional(),
});
export type Store = z.infer<typeof storeSchema>;
export type GoogleToken = z.infer<typeof googleTokenSchema>;
export type GithubConnection = z.infer<typeof githubTokenSchema>;
export const tokenResponse = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().optional(),
  expires_in: z.number().positive(),
  scope: z.string().optional(),
});
export const scopes = Object.values(googleScopes);
export const maxBytes = 2_000_000;
export async function boundedText(response: Response) {
  if (Number(response.headers.get('content-length')) > maxBytes) {
    await response.body?.cancel();
    throw new Error(
      'Connector response is too large. Narrow the query or select a smaller file/range.',
    );
  }
  const reader = response.body?.getReader();
  if (!reader) return '';
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes)
        throw new Error(
          'Connector response is too large. Narrow the query or select a smaller file/range.',
        );
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks).toString('utf8');
}
