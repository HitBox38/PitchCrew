export interface BrowserHistoryEntry {
  url: string;
  title: string;
  visitedAt: number;
}

export const browserHistoryLimit = 50;
export const browserClosedTabsLimit = 20;

/** Keep navigable page addresses while excluding transient sign-in credentials. */
export const historyAddress = (value: string) => {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    if (/(?:[?&#])(?:code|access_token|id_token|token)=/i.test(url.search + url.hash)) return null;
    return url.href.length <= 2048 ? url.href : null;
  } catch {
    return null;
  }
};

export const rememberBrowserPage = (
  entries: readonly BrowserHistoryEntry[],
  page: Pick<BrowserHistoryEntry, 'url' | 'title'>,
  visitedAt = Date.now(),
  limit = browserHistoryLimit,
): BrowserHistoryEntry[] => {
  const url = historyAddress(page.url);
  if (!url) return [...entries];
  return [
    { url, title: page.title.slice(0, 512), visitedAt },
    ...entries.filter((entry) => entry.url !== url),
  ].slice(0, limit);
};

export const readBrowserHistory = (value: string | null): BrowserHistoryEntry[] => {
  try {
    const parsed: unknown = JSON.parse(value ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is BrowserHistoryEntry =>
          !!item &&
          typeof item === 'object' &&
          typeof item.url === 'string' &&
          historyAddress(item.url) === item.url &&
          typeof item.title === 'string' &&
          item.title.length <= 512 &&
          typeof item.visitedAt === 'number' &&
          Number.isFinite(item.visitedAt),
      )
      .slice(0, browserHistoryLimit);
  } catch {
    return [];
  }
};
