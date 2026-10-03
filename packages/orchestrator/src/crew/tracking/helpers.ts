import {
  canonicalJobUrl,
  normalizeApplicationText,
  type Card,
  type CardState,
} from '@pitchcrew/core';
import { createHash } from 'node:crypto';
import { z } from 'zod';

export const trackingId = (...parts: string[]) =>
  createHash('sha256').update(JSON.stringify(parts)).digest('hex');
export const verifiedGmail = z.object({
  id: z.string().min(1),
  threadId: z.string().min(1),
  internalDate: z.string().regex(/^\d+$/),
  text: z.string().max(60000),
  textTruncated: z.boolean().optional(),
  snippet: z.string().max(10000).optional(),
  headers: z
    .array(z.object({ name: z.string().max(200), value: z.string().max(8000) }))
    .max(100)
    .default([]),
});
export type VerifiedGmail = z.infer<typeof verifiedGmail>;
export function messageBody(message: VerifiedGmail): string {
  return [
    message.headers.find((header) => header.name.toLowerCase() === 'subject')?.value ?? '',
    message.text,
    message.snippet ?? '',
  ].join('\n');
}
export function sourceState(body: string): CardState | null {
  // Quoted conversations can contain older, contradictory decisions.
  if (
    /^\s*>|\bon .{0,100}wrote:|forwarded message|original message|^from:.*\n(?:sent|date):/im.test(
      body,
    )
  )
    return null;
  const text = normalizeApplicationText(body);
  const rules: [CardState, RegExp][] = [
    [
      'rejected',
      /(?:will not|won't|not be) (?:be )?(?:moving|proceeding) (?:forward|with)|decided not to (?:pursue|proceed with)|unable to (?:pursue|proceed with)|application (?:was|has been) unsuccessful/,
    ],
    [
      'screening',
      /(?:we (?:would like to|are pleased to) invite you to|please schedule) (?:a |your )?(?:phone screen|screening call)/,
    ],
    [
      'interviewing',
      /(?:we (?:would like to|are pleased to) invite you to|please schedule) (?:an? |your )?interview/,
    ],
    ['offer', /we are (?:pleased|delighted|happy) to (?:offer you|extend (?:you )?an? offer)/],
    ['submitted', /(?:received your application|thank you for applying)/],
  ];
  const matches = rules.filter(([, rule]) => rule.test(text));
  if (matches.length !== 1) return null;
  const state = matches[0]![0];
  if (
    state !== 'rejected' &&
    /\b(?:not|cannot|can't|unable|won't|no longer|decline|cancelled|canceled)\b/.test(text)
  )
    return null;
  return state;
}
export function sourceMatches(
  card: Card,
  body: string,
  account: string,
  threadId: string,
): boolean {
  if (
    card.tracking?.gmailThreads.some(
      (link) => link.account === account && link.threadId === threadId,
    )
  )
    return true;
  const identifier = card.tracking?.jobIdentifier;
  if (identifier) {
    const labels = [
      ...body.matchAll(/(?:job|requisition|position) (?:id|number|#)\s*[:#]?\s*([^\s,;.]+)/gi),
    ];
    if (
      labels.some(
        (value) => normalizeApplicationText(value[1]!) === normalizeApplicationText(identifier),
      )
    )
      return true;
  }
  const urls = body.match(/https?:\/\/[^\s<>"')]+/g) ?? [];
  const canonical = canonicalJobUrl(card.url);
  return (
    !!canonical && urls.some((url) => canonicalJobUrl(url.replace(/[.,;]+$/, '')) === canonical)
  );
}
export function identityInSource(company: string, title: string, body: string): boolean {
  const text = normalizeApplicationText(body);
  return (
    text.includes(normalizeApplicationText(company)) &&
    text.includes(normalizeApplicationText(title))
  );
}
