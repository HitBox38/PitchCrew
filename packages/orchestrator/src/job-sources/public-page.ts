import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { publicAddress } from '@pitchcrew/mcp/computer';
import { maxJobLinkLength, recognizeJobLink } from '@pitchcrew/core';
import { requestTimeoutMs, userAgent } from './fetch.ts';

/** Resolve once, reject every private answer, and pin the connection to a checked address. */
const readPage = async (value: string, signal: AbortSignal) => {
  if (value.length > maxJobLinkLength) throw new Error('This job URL is too long.');
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port)
    throw new Error('Use a public HTTP(S) job URL without credentials or a custom port.');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await lookup(hostname, { all: true });
  signal.throwIfAborted();
  if (!addresses.length || addresses.some(({ address }) => !publicAddress(address)))
    throw new Error('Local and private network job URLs are blocked.');
  const pinned = addresses[0]!;
  return new Promise<{ html?: string; redirect?: string }>((resolve, reject) => {
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(
      url,
      {
        signal,
        agent: false,
        family: pinned.family,
        lookup: (_hostname, _options, done) => done(null, pinned.address, pinned.family),
        headers: { accept: 'text/html', 'accept-encoding': 'identity', 'user-agent': userAgent },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
          try {
            resolve({ redirect: new URL(response.headers.location, url).href });
          } catch {
            reject(new Error('The job page returned an invalid redirect.'));
          }
          response.destroy();
          return;
        }
        const fail = (message: string) => {
          reject(new Error(message));
          response.destroy();
        };
        if (status !== 200) return fail(`The job page returned HTTP ${status}.`);
        if (
          !/^(?:text\/html|application\/xhtml\+xml)\b/i.test(response.headers['content-type'] ?? '')
        )
          return fail('The job URL did not return an HTML page.');
        if (
          response.headers['content-encoding'] &&
          response.headers['content-encoding'] !== 'identity'
        )
          return fail('The job page returned an unsupported encoding.');
        if (Number(response.headers['content-length']) > maxBytes)
          return fail('The job page is too large.');
        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) fail('The job page is too large.');
          else chunks.push(chunk);
        });
        response.on('error', reject);
        response.on('end', () => resolve({ html: Buffer.concat(chunks).toString('utf8') }));
      },
    );
    request.on('error', reject);
    request.end();
  });
};

export interface PublicJobPage {
  url: string;
  html: string;
}
export type ReadJobPage = (url: string, signal: AbortSignal) => Promise<PublicJobPage>;
const maxBytes = 400_000;

/** No cookies, scripts or subresources. Every redirect gets a new public-address check. */
export const readPublicJobPage: ReadJobPage = async (value, cancellation) => {
  const signal = AbortSignal.any([cancellation, AbortSignal.timeout(requestTimeoutMs)]);
  // Bound DNS resolution as well as the request, even if the resolver ignores cancellation.
  return new Promise<PublicJobPage>((resolve, reject) => {
    const stop = () => reject(new Error('The job page request was stopped or timed out.'));
    signal.addEventListener('abort', stop, { once: true });
    if (signal.aborted) stop();
    const work = async () => {
      let url = value;
      for (let redirects = 0; redirects <= 3; redirects++) {
        signal.throwIfAborted();
        const result = await readPage(url, signal);
        if (!result.redirect) return { url, html: result.html ?? '' };
        if (redirects === 3) throw new Error('The job page redirected too many times.');
        // The importer can read this through a fixed API; never fetch or persist token-bearing pages.
        if (recognizeJobLink(result.redirect).recognized) return { url: result.redirect, html: '' };
        url = result.redirect;
      }
      throw new Error('The job page redirected too many times.');
    };
    work()
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', stop));
  });
};
