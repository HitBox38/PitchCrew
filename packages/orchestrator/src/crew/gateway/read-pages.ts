import { createHash } from 'node:crypto';
import { readFieldQuery, type Card } from '@pitchcrew/core';

// Leave room for the envelope, cursors and field names in both MCP representations.
export const readPageBytes = 8 * 1024;
const valueBytes = 6 * 1024;
export const jsonBytes = (value: unknown): number => Buffer.byteLength(JSON.stringify(value));

/** Resolve only own properties of the already-authorized projection. */
export const readField = (
  record: object,
  field: string,
  cursor?: string,
): Record<string, unknown> => {
  let value: unknown = record;
  for (const key of field.split('.')) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, key))
      throw new Error('Field not found in this record.');
    value = (value as Record<string, unknown>)[key];
  }
  if (value === undefined) throw new Error('Field not found in this record.');
  const json = JSON.stringify(value);
  if (!cursor && Buffer.byteLength(json) <= valueBytes) return { field, value };
  const encoding = typeof value === 'string' ? 'text' : 'json';
  const source = typeof value === 'string' ? value : json;
  const revision = createHash('sha256').update(field).update('\0').update(json).digest('hex');
  const [previous, position] = cursor?.split(':') ?? [];
  const start = Number(position ?? 0);
  if (cursor && (revision !== previous || start >= source.length))
    throw new Error('Field changed or cursor expired. Read it again without a cursor.');
  let length = Math.min(valueBytes, source.length - start);
  while (jsonBytes(source.slice(start, start + length)) > valueBytes)
    length = Math.floor(length / 2);
  let end = start + length;
  // Keep a supplementary character together for consumers that process pages separately.
  if (end < source.length && /[\uD800-\uDBFF]/u.test(source.charAt(end - 1))) end--;
  return {
    field,
    encoding,
    text: source.slice(start, end),
    nextCursor: end < source.length ? `${revision}:${end}` : null,
  };
};

export const readCardPage = (card: Card, data: unknown): Record<string, unknown> => {
  const { field, cursor } = readFieldQuery.parse(data);
  if (field) return readField(card, field, cursor);
  if (cursor) throw new Error('Choose the field to continue reading.');
  const fields = Object.entries(card)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ({ key, value, bytes: jsonBytes({ [key]: value }) }))
    .sort((a, b) => a.bytes - b.bytes);
  const included: Record<string, unknown> = {};
  const omittedFields: string[] = [];
  let bytes = 0;
  for (const entry of fields) {
    if (bytes + entry.bytes > valueBytes) omittedFields.push(entry.key);
    else {
      included[entry.key] = entry.value;
      bytes += entry.bytes;
    }
  }
  if (!omittedFields.length) return { card };
  const context = card.applicationContext;
  return {
    card: included,
    omittedFields,
    ...(context && omittedFields.includes('applicationContext')
      ? {
          contextStatus: {
            revision: context.revision,
            confirmedRevision: context.confirmedRevision ?? null,
            form: context.form?.status ?? null,
          },
        }
      : {}),
  };
};
