import { z } from 'zod';
const id = z.union([z.literal('default'), z.uuid()]);
export const browserProfilesCommandSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('list') }).strict(),
  z.object({ kind: z.literal('create'), name: z.string().trim().min(1).max(60) }).strict(),
  z.object({ kind: z.literal('rename'), id, name: z.string().trim().min(1).max(60) }).strict(),
  z.object({ kind: z.enum(['select', 'remove', 'begin-import']), id }).strict(),
  z.object({ kind: z.enum(['confirm-import', 'cancel-import']), token: z.uuid() }).strict(),
]);
export type BrowserProfilesCommand = z.infer<typeof browserProfilesCommandSchema>;
export interface BrowserProfilesState {
  profiles: { id: string; name: string }[];
  selectedId: string;
  currentId: string;
  preview?: {
    token: string;
    profileName: string;
    count: number;
    skipped: number;
    domains: string[];
  };
  imported?: number;
}
