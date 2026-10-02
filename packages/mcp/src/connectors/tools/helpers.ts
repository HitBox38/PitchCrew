import type { AgentCapabilities } from '@pitchcrew/core';
import { z } from 'zod';

export interface ConnectorRequest {
  url: URL;
  text?: boolean;
  transform?: (data: unknown) => Record<string, unknown>;
}
export function request(
  base: string,
  path: string,
  params: Record<string, string | number | undefined> = {},
): ConnectorRequest {
  const url = new URL(path, base);
  for (const [key, value] of Object.entries(params))
    if (value !== undefined) url.searchParams.set(key, String(value));
  return { url };
}
export const github = (path: string, params?: Record<string, string | number | undefined>) =>
  request('https://api.github.com', path, params);
export const google = (path: string, params?: Record<string, string | number | undefined>) =>
  request('https://www.googleapis.com', path, params);
export const id = z
  .string()
  .regex(/^[a-zA-Z0-9_-]{1,200}$/)
  .describe('Resource ID returned by a search or list tool.');
export const segment = z
  .string()
  .regex(/^[a-zA-Z0-9_.-]{1,100}$/)
  .refine((v) => v !== '.' && v !== '..');
export const page = {
  page: z.number().int().min(1).max(100).default(1),
  limit: z.number().int().min(1).max(50).default(20),
};
export const googlePage = { pageToken: z.string().max(2000).optional(), limit: page.limit };
export const repo = { owner: segment, repo: segment };
export function tool<T extends z.ZodRawShape>(
  permission: keyof AgentCapabilities,
  description: string,
  shape: T,
  build: (input: z.infer<z.ZodObject<T>>) => ConnectorRequest,
) {
  const schema = z.object(shape).strict();
  return {
    permission,
    provider: permission === 'github' ? ('github' as const) : ('google' as const),
    description,
    schema,
    request: (input: unknown) => build(schema.parse(input)),
  };
}
export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function repository(value: unknown) {
  const data = record(value);
  return {
    id: data.id,
    full_name: data.full_name,
    description: data.description,
    html_url: data.html_url,
    private: data.private,
    language: data.language,
    topics: data.topics,
    updated_at: data.updated_at,
    archived: data.archived,
  };
}
export function githubPage(
  value: unknown,
  pageNumber: number,
  limit: number,
  map: (value: unknown) => Record<string, unknown>,
) {
  const data = record(value);
  const items = Array.isArray(value) ? value : Array.isArray(data.items) ? data.items : [];
  const more =
    typeof data.total_count === 'number'
      ? pageNumber * limit < Math.min(data.total_count, 1000)
      : items.length === limit;
  return {
    items: items.map(map),
    page: pageNumber,
    nextPage: more && pageNumber < 100 ? pageNumber + 1 : null,
    totalCount: data.total_count,
    incompleteResults: data.incomplete_results,
  };
}
export function gmailMessage(value: unknown) {
  const data = record(value);
  const payload = record(data.payload);
  const parts: string[] = [];
  function readPart(part: Record<string, unknown>) {
    const body = record(part.body);
    if (part.mimeType === 'text/plain' && typeof body.data === 'string')
      parts.push(Buffer.from(body.data, 'base64url').toString('utf8'));
    if (Array.isArray(part.parts)) part.parts.forEach((p) => readPart(record(p)));
  }
  readPart(payload);
  return {
    id: data.id,
    threadId: data.threadId,
    snippet: data.snippet,
    labelIds: data.labelIds,
    internalDate: data.internalDate,
    headers: payload.headers,
    text: parts.join('\n').slice(0, 60000),
  };
}
