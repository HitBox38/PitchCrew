/**
 * The smallest single replacement that turns `current` into `next`, so an outside update (a
 * discard, a newer saved copy) keeps the caret and scroll wherever the text did not change.
 */
export const syncChange = (current: string, next: string) => {
  if (current === next) return null;
  let start = 0;
  const shortest = Math.min(current.length, next.length);
  while (start < shortest && current[start] === next[start]) start++;
  let end = 0;
  while (
    end < shortest - start &&
    current[current.length - 1 - end] === next[next.length - 1 - end]
  )
    end++;
  return {
    from: start,
    to: current.length - end,
    insert: next.slice(start, next.length - end),
  };
};

export interface OutlineEntry {
  level: number;
  text: string;
  /** 1-based source line. */
  line: number;
}

/** ATX headings outside fenced code, with their Markdown marks and emphasis stripped. */
export const markdownOutline = (content: string): OutlineEntry[] => {
  const entries: OutlineEntry[] = [];
  let fence: string | null = null;
  content.split(/\r\n?|\n/).forEach((text, index) => {
    const opener = /^ {0,3}(`{3,}|~{3,})/.exec(text);
    if (opener) {
      if (!fence) fence = opener[1][0].repeat(opener[1].length);
      else if (text.trim().startsWith(fence)) fence = null;
      return;
    }
    if (fence) return;
    const heading = /^ {0,3}(#{1,6})[ \t]+(.+?)[ \t#]*$/.exec(text);
    if (!heading) return;
    const label = heading[2]
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_~`]/g, '')
      .trim();
    if (label) entries.push({ level: heading[1].length, text: label, line: index + 1 });
  });
  return entries;
};

/** Words in prose: Markdown marks and link targets do not count. */
export const proseWordCount = (content: string) =>
  content
    .replace(/\]\([^)]*\)/g, ']')
    .replace(/\[[ xX]\]/g, ' ')
    .split(/\s+/u)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
