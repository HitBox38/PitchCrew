/** UTF-16 offsets into the canonical message text. Labels are snapshots, never identity. */
export interface ChatReference {
  kind: 'agent' | 'skill' | 'action';
  id: string;
  label: string;
  token: string;
  start: number;
  end: number;
  revision?: string;
  digest?: string;
}
export type ChatReferenceInput = Omit<ChatReference, 'label' | 'digest'>;
export interface ChatToken {
  symbol: '@' | '$' | '/';
  query: string;
  start: number;
  end: number;
}

export function skillToken(name: string, id?: string): string {
  const slug =
    name
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'skill';
  return `$${slug}${id ? `-${id.slice(0, 8)}` : ''}`;
}

/** Code, links and URLs cannot accidentally select instructions or recipients. */
export function protectedChatRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  const pattern = /(`+|~{3,})|!?\[[^\]\n]*\]\([^\n)]*\)|https?:\/\/\S+/g;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    let end = match.index + match[0].length;
    if (match[1]) {
      const close = text.indexOf(match[1], end);
      end = close < 0 ? text.length : close + match[1].length;
    }
    ranges.push([match.index, end]);
    pattern.lastIndex = end;
  }
  return ranges;
}

export function chatTokens(text: string): ChatToken[] {
  const protectedRanges = protectedChatRanges(text);
  const tokens: ChatToken[] = [];
  for (const match of text.matchAll(/(?:^|\s)([@$/])([a-zA-Z][a-zA-Z0-9_-]*)(?=$|\s|[.,!?;:])/g)) {
    const start = match.index + match[0].length - match[1]!.length - match[2]!.length;
    if (protectedRanges.some(([from, to]) => start >= from && start < to)) continue;
    tokens.push({
      symbol: match[1] as ChatToken['symbol'],
      query: match[2]!,
      start,
      end: start + match[1]!.length + match[2]!.length,
    });
  }
  return tokens;
}

export function chatTrigger(text: string, caret: number): ChatToken | null {
  const prefix = text.slice(0, caret);
  const match = /(?:^|\s)([@$/])([a-zA-Z][a-zA-Z0-9_-]*|)$/.exec(prefix);
  if (!match) return null;
  const start = caret - match[1]!.length - match[2]!.length;
  const wordEnd = text.slice(caret).search(/\s|$/);
  if (text.slice(start + 1, caret + wordEnd).includes('/')) return null;
  if (protectedChatRanges(text).some(([from, to]) => start >= from && start < to)) return null;
  return {
    symbol: match[1] as ChatToken['symbol'],
    query: match[2]!,
    start,
    end: caret + (text.slice(caret).match(/^[a-zA-Z0-9_-]*/)?.[0].length ?? 0),
  };
}

export function validChatReferences(
  text: string,
  references: readonly ChatReference[],
): ChatReference[] {
  const tokens = chatTokens(text);
  return references.filter(
    (ref) =>
      text.slice(ref.start, ref.end) === ref.token &&
      tokens.some((token) => token.start === ref.start && token.end === ref.end),
  );
}
