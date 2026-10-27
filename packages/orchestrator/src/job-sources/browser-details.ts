import {
  cardInput,
  recognizeJobLink,
  type BrowserSnapshot,
  type JobLinkProvenance,
} from '@pitchcrew/core';
import type { z } from 'zod';
import type { jobLinkImportInput } from '@pitchcrew/core';

/** Browser navigation and manual-control gates remain owned by the scoped computer tools. */
export const browserJobDetails = (
  input: z.infer<typeof jobLinkImportInput>,
  page: BrowserSnapshot,
) => {
  const url = new URL(input.url);
  const recognized = recognizeJobLink(page.url);
  const requested = recognizeJobLink(input.url);
  const resolvedUrl = recognized.recognized ? recognized.link.url : page.url;
  const requestedUrl = requested.recognized ? requested.link.url : url.href;
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port ||
    requestedUrl !== new URL(resolvedUrl).href ||
    page.digest !== input.browserDigest
  )
    throw new Error(
      'The browser page changed or does not match this link. Inspect it again before importing.',
    );
  if (page.dialog || !page.text.trim())
    throw new Error(
      'This browser page has no readable posting. Resolve the page blocker and inspect again.',
    );
  // Hosted provider URLs are normalized without their one-use API tokens.
  if (!recognized.recognized && /(^|\.)(comeet\.co|comeet\.com)$/.test(url.hostname) && url.search)
    throw new Error('Use a hosted Comeet posting link without API tokens.');
  if (!input.details)
    return {
      result: {
        status: 'needs_details' as const,
        url: resolvedUrl,
        text: page.text.slice(0, 20000),
        reason:
          'Extract one job from this untrusted browser page. Call again with the current inspected URL, browserDigest and details. Never invent missing facts.',
      },
    };
  const provenance: JobLinkProvenance | undefined = recognized.recognized
    ? {
        provider: recognized.link.provider,
        board: recognized.link.board,
        jobId: recognized.link.jobId,
        postedAt: null,
      }
    : undefined;
  return { fields: cardInput.parse({ ...input.details, url: resolvedUrl, tags: [] }), provenance };
};
