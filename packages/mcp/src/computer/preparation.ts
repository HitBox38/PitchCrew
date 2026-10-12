import type { Page, Request } from 'playwright';

/** Preparation never authorizes a write or script-driven navigation. User-approved actions do. */
export function preparationGuard() {
  let enabled = false;
  let sites: readonly string[] = [];
  let navigating = false;
  let blocked = false;
  let submissions = new Set<string>();
  const rejects = (request: Request) => {
    const url = new URL(request.url());
    const rejected =
      enabled &&
      (!['GET', 'HEAD'].includes(request.method()) ||
        (request.isNavigationRequest() && (!navigating || !sites.includes(url.origin))) ||
        (!navigating && submissions.has(`${url.origin}${url.pathname}`)));
    if (rejected) blocked = true;
    return rejected;
  };
  return {
    rejects,
    get blocked() {
      return blocked;
    },
    protect(urls: string[]) {
      submissions = new Set(
        urls.map((value) => {
          const url = new URL(value);
          return `${url.origin}${url.pathname}`;
        }),
      );
    },
    reset() {
      blocked = false;
      submissions.clear();
    },
    prepare(value: boolean, allowedSites?: readonly string[]) {
      enabled = value;
      if (!value) blocked = false;
      if (allowedSites) sites = allowedSites;
    },
    navigate(value: boolean) {
      navigating = value;
    },
    async attach(page: Page) {
      await page.route('**/*', async (route) => {
        const request = route.request();
        if (rejects(request)) {
          await route.abort('blockedbyclient');
          return;
        }
        await route.fallback();
      });
    },
  };
}
