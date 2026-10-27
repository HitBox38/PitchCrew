import type { Page, Request, Response, ConsoleMessage } from 'playwright';
import type { BrowserDiagnostics } from '@pitchcrew/core';

export const diagnosticUrl = (value: string) => {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return '[non-web resource]';
    const path = url.pathname
      .split('/')
      .map((part) =>
        part.length > 32 || /@|%40|^[0-9a-f-]{16,}$/i.test(part) ? '[redacted]' : part,
      )
      .join('/');
    return `${url.origin}${path}`.slice(0, 300);
  } catch {
    return '[unavailable resource]';
  }
};
export const diagnosticMessage = (value: string) => {
  // Arbitrary console output can contain session data. Only expose recognized engine failures.
  if (
    !/^(?:Uncaught\s+)?(?:TypeError|ReferenceError|SyntaxError|RangeError|NetworkError|Failed to (?:load|fetch)|Load failed|net::ERR_)/i.test(
      value,
    )
  )
    return 'The website reported an error.';
  return value
    .replace(/https?:\/\/[^\s"'<>]+/gi, diagnosticUrl)
    .replace(/(["'`]).*?\1/g, '[redacted]')
    .replace(/(?:Bearer\s+|(?:token|password|secret|authorization)\s*[:=]\s*)\S+/gi, '[redacted]')
    .replace(/[A-Za-z0-9_+/=-]{24,}/g, '[redacted]')
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[redacted]')
    .slice(0, 400);
};
export const browserDiagnostics = () => {
  const records = new Map<Page, BrowserDiagnostics>();
  const cleanup = new Map<Page, () => void>();
  let privateControl = false;
  const empty = (): BrowserDiagnostics => ({ console: [], requests: [] });
  const attach = (page: Page) => {
    if (cleanup.has(page)) return;
    const data = empty();
    records.set(page, data);
    const consoleMessage = (message: ConsoleMessage) => {
      if (privateControl || !['warning', 'error'].includes(message.type())) return;
      data.console.push({ level: message.type(), message: diagnosticMessage(message.text()) });
      data.console.splice(0, Math.max(0, data.console.length - 30));
    };
    const error = (value: Error) => {
      if (privateControl) return;
      data.console.push({
        level: 'error',
        message: diagnosticMessage(`${value.name}: ${value.message}`),
      });
      data.console.splice(0, Math.max(0, data.console.length - 30));
    };
    const request = (value: Request, status: number | null) => {
      if (privateControl) return;
      data.requests.push({
        url: diagnosticUrl(value.url()),
        method: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(
          value.method(),
        )
          ? value.method()
          : 'OTHER',
        status,
        resourceType: value.resourceType(),
      });
      data.requests.splice(0, Math.max(0, data.requests.length - 30));
    };
    const response = (value: Response) => {
      if (value.status() >= 400) request(value.request(), value.status());
    };
    const failed = (value: Request) => request(value, null);
    const reset = () => {
      data.console.length = 0;
      data.requests.length = 0;
    };
    page.on('console', consoleMessage);
    page.on('pageerror', error);
    page.on('response', response);
    page.on('requestfailed', failed);
    const navigate = () => reset();
    page.on('domcontentloaded', navigate);
    cleanup.set(page, () => {
      page.off('console', consoleMessage);
      page.off('pageerror', error);
      page.off('response', response);
      page.off('requestfailed', failed);
      page.off('domcontentloaded', navigate);
      records.delete(page);
    });
  };
  return {
    attach,
    privateControl: (enabled: boolean) => {
      privateControl = enabled;
      for (const data of records.values()) {
        data.console.length = 0;
        data.requests.length = 0;
      }
    },
    read: (page: Page): BrowserDiagnostics => {
      const data = records.get(page) ?? empty();
      return privateControl
        ? empty()
        : { console: [...data.console], requests: [...data.requests] };
    },
    detach: (page: Page) => {
      cleanup.get(page)?.();
      cleanup.delete(page);
    },
    close: () => {
      for (const stop of cleanup.values()) stop();
      cleanup.clear();
    },
  };
};
