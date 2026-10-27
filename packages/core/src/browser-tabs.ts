import { z } from 'zod';
export const browserTabsSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.enum(['list', 'open']) }).strict(),
  z.object({ kind: z.enum(['select', 'close']), tabId: z.string().min(1).max(100) }).strict(),
]);
export type BrowserTabsCommand = z.infer<typeof browserTabsSchema>;
export interface BrowserTab {
  id: string;
  url: string;
  title: string;
  active: boolean;
}
