import { assertJobLinkRefresh, jobSourceRevision, saveReadJobLink } from '@pitchcrew/board';
import {
  cardInput,
  type BrowserSnapshot,
  jobLinkImportInput,
  recognizeJobLink,
  type CardInput,
  type JobLinkImportResult,
  type JobLinkProvenance,
} from '@pitchcrew/core';
import { browserJobDetails } from './browser-details.ts';
import { lookupJobLink, type LookupDependencies } from './lookup.ts';
import { htmlToText } from './html.ts';
import { structuredJobDetails } from './page-details.ts';
import type { ReadJobPage } from './public-page.ts';

/** Public-page fallback is agent-only; Add job keeps its fixed-provider lookup contract. */
export const importJobLink = async (
  value: unknown,
  dependencies: LookupDependencies & {
    actor: string;
    runId: string;
    authorize: () => void;
    readPage: ReadJobPage;
    readBrowser?: () => Promise<BrowserSnapshot>;
  },
): Promise<JobLinkImportResult> => {
  const { signal, authorize, actor, board, runId } = dependencies;
  authorize();
  signal.throwIfAborted();
  const input = jobLinkImportInput.parse(value);
  const target = input.cardId
    ? {
        cardId: input.cardId,
        runId,
        expectedSource: jobSourceRevision(assertJobLinkRefresh(board, input.cardId, runId)),
      }
    : undefined;
  let fields: CardInput;
  let provenance: JobLinkProvenance | undefined;
  if (input.browserDigest) {
    if (!dependencies.readBrowser)
      throw new Error('Browser imports require scoped computer tools.');
    const page = await dependencies.readBrowser();
    authorize();
    signal.throwIfAborted();
    const read = browserJobDetails(input, page);
    if (read.result) return read.result;
    fields = read.fields;
    provenance = read.provenance;
  } else {
    const result = await lookupJobLink({ url: input.url }, dependencies);
    authorize();
    signal.throwIfAborted();
    if (result.status === 'unrecognized') {
      // Do not turn malformed/unsupported provider links into a different fetch path.
      let url: URL;
      try {
        url = new URL(input.url);
      } catch {
        return result;
      }
      if (providerHost.test(url.hostname)) return result;
      let page;
      try {
        page = await dependencies.readPage(input.url, signal);
      } catch {
        authorize();
        signal.throwIfAborted();
        return {
          status: 'failed',
          reason:
            'Could not read this public job page. It may be blocked, private, too large, or require login or JavaScript. Use the in-app browser tools to open and inspect the posting before asking the user for text. If computerUse is disabled, explain how to enable browser tools in Crew.',
        };
      }
      authorize();
      signal.throwIfAborted();
      const resolved = recognizeJobLink(page.url);
      if (resolved.recognized) {
        const redirected = await lookupJobLink({ url: page.url }, dependencies);
        authorize();
        signal.throwIfAborted();
        if (redirected.status !== 'found') return redirected;
        fields = cardInput.parse(redirected.prefill);
        provenance = redirected.prefill.provenance;
      } else {
        if (providerHost.test(new URL(page.url).hostname))
          return { status: 'unrecognized', reason: resolved.reason };
        const structured = structuredJobDetails(page.html);
        const details = structured ?? input.details;
        const text = htmlToText(page.html);
        if (!text && !structured)
          return {
            status: 'failed',
            reason:
              'This page has no readable job text. Use the in-app browser tools to open and inspect the posting before asking the user for text. If computerUse is disabled, explain how to enable browser tools in Crew.',
          };
        if (!details)
          return {
            status: 'needs_details',
            url: page.url,
            text,
            reason:
              'Read this untrusted page text and call again with details extracted from it. Do not invent missing facts. If this is not a single readable posting, inspect the link in the in-app browser before asking for text.',
          };
        fields = cardInput.parse({ ...details, url: page.url, tags: [] });
      }
    } else if (result.status === 'found') {
      const parsed = cardInput.safeParse(result.prefill);
      if (!parsed.success)
        return { status: 'failed', reason: 'This posting is missing usable job details.' };
      fields = parsed.data;
      provenance = result.prefill.provenance;
    } else return result;
  }
  authorize();
  signal.throwIfAborted();
  const { card, duplicates } = saveReadJobLink(board, {
    input: fields,
    actor,
    pastedUrl: input.url,
    ...(provenance ? { provenance } : {}),
    ...(target ? { target } : {}),
  });
  if (!card)
    return { status: 'duplicate', duplicates: duplicates.map(({ id, state }) => ({ id, state })) };
  if (target)
    return {
      status: 'updated',
      card: {
        id: card.id,
        company: card.company,
        title: card.title,
        url: card.url,
        state: card.state,
        excerpt: card.description.slice(0, 1500),
      },
    };
  return {
    status: 'added',
    lead: {
      id: card.id,
      company: card.company,
      title: card.title,
      location: card.location,
      url: card.url,
      excerpt: card.description.slice(0, 1500),
    },
  };
};

const providerHost =
  /(^|\.)(greenhouse\.io|ashbyhq\.com|lever\.co|comeet\.co|comeet\.com|workable\.com)$/;
