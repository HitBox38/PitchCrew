import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import type { ClientRequest, IncomingMessage, RequestOptions } from 'node:http';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readPublicJobPage } from '../src/job-sources/public-page.ts';
import { structuredJobDetails } from '../src/job-sources/page-details.ts';

const network = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock('node:dns/promises', () => ({ lookup: network.lookup }));
vi.mock('node:https', () => ({ request: network.request }));
vi.mock('node:http', () => ({ request: network.request }));
const url = 'https://careers.example/job/42';
const signal = () => new AbortController().signal;
let reply: { statusCode: number; headers: Record<string, string>; chunks: Buffer[] };
beforeEach(() => {
  network.lookup.mockReset().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  reply = {
    statusCode: 200,
    headers: { 'content-type': 'text/html' },
    chunks: [Buffer.from('<p>Job</p>')],
  };
  network.request
    .mockReset()
    .mockImplementation(
      (_url: URL, _options: RequestOptions, respond: (value: IncomingMessage) => void) => {
        const request = new EventEmitter() as ClientRequest;
        request.end = (() => {
          const response = Readable.from(reply.chunks) as IncomingMessage;
          response.statusCode = reply.statusCode;
          response.headers = reply.headers;
          queueMicrotask(() => respond(response));
          return request;
        }) as ClientRequest['end'];
        return request;
      },
    );
});
afterEach(() => vi.useRealTimers());

it('pins the socket lookup to a validated public address and sends no ambient credentials', async () => {
  expect(await readPublicJobPage(url, signal())).toEqual({ url, html: '<p>Job</p>' });
  const [target, options] = network.request.mock.calls[0] as [URL, RequestOptions];
  expect(target.href).toBe(url);
  expect(options).toMatchObject({
    agent: false,
    family: 4,
    headers: { 'accept-encoding': 'identity', accept: 'text/html' },
  });
  expect(options.headers).not.toHaveProperty('cookie');
  expect(options.headers).not.toHaveProperty('authorization');
  const done = vi.fn();
  const pinnedLookup = options.lookup as (
    hostname: string,
    options: object,
    callback: typeof done,
  ) => void;
  pinnedLookup('careers.example', {}, done);
  expect(done).toHaveBeenCalledWith(null, '93.184.216.34', 4);
  expect(network.lookup).toHaveBeenCalledTimes(1);
});

it.each([
  'https://127.0.0.1/job',
  'http://10.0.0.1/job',
  'https://[::1]/job',
  'https://[::ffff:127.0.0.1]/job',
  'file:///etc/passwd',
  'https://user:secret@careers.example/job',
  'https://careers.example:4417/job',
])('rejects unsafe URL %s before connecting', async (value) => {
  await expect(readPublicJobPage(value, signal())).rejects.toThrow();
  expect(network.request).not.toHaveBeenCalled();
});

it('rejects mixed public/private DNS answers and private redirect destinations', async () => {
  network.lookup.mockResolvedValueOnce([
    { address: '93.184.216.34', family: 4 },
    { address: '192.168.1.1', family: 4 },
  ]);
  await expect(readPublicJobPage(url, signal())).rejects.toThrow('private');
  expect(network.request).not.toHaveBeenCalled();
  reply = {
    statusCode: 302,
    headers: { location: 'http://169.254.169.254/latest/meta-data' },
    chunks: [],
  };
  await expect(readPublicJobPage(url, signal())).rejects.toThrow('private');
  expect(network.request).toHaveBeenCalledTimes(1);
});

it('hands recognized provider redirects back without fetching the token-bearing posting page', async () => {
  const target = 'https://www.comeet.co/jobs/A1.B2C/A1.00D?token=fixtureToken';
  reply = { statusCode: 302, headers: { location: target }, chunks: [] };
  expect(await readPublicJobPage(url, signal())).toEqual({ url: target, html: '' });
  expect(network.request).toHaveBeenCalledTimes(1);
});

it('bounds redirect loops and checks each destination', async () => {
  reply = { statusCode: 302, headers: { location: '/job/43' }, chunks: [] };
  await expect(readPublicJobPage(url, signal())).rejects.toThrow('too many');
  expect(network.request).toHaveBeenCalledTimes(4);
  expect(network.lookup).toHaveBeenCalledTimes(4);
});

it.each(['status', 'type', 'encoding', 'declared-size', 'stream-size'] as const)(
  'rejects invalid response %s',
  async (kind) => {
    if (kind === 'status') reply.statusCode = 403;
    if (kind === 'type') reply.headers['content-type'] = 'application/pdf';
    if (kind === 'encoding') reply.headers['content-encoding'] = 'gzip';
    if (kind === 'declared-size') reply.headers['content-length'] = '400001';
    if (kind === 'stream-size') reply.chunks = [Buffer.alloc(200000), Buffer.alloc(200001)];
    await expect(readPublicJobPage(url, signal())).rejects.toThrow();
  },
);

it('bounds DNS stalls and does not connect after cancellation', async () => {
  const timeout = new AbortController();
  const timer = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal);
  let finish!: (value: unknown) => void;
  network.lookup.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  try {
    const pending = readPublicJobPage(url, signal());
    const rejected = expect(pending).rejects.toThrow('timed out');
    timeout.abort();
    await rejected;
    finish([{ address: '93.184.216.34', family: 4 }]);
    await Promise.resolve();
    expect(network.request).not.toHaveBeenCalled();
  } finally {
    timer.mockRestore();
  }
});

it('reads one nested structured posting without executing markup and rejects ambiguous metadata', () => {
  const posting = {
    '@type': 'JobPosting',
    title: '<b>Engineer</b>',
    hiringOrganization: { name: 'Northwind' },
    description: '<p>Build apps</p><script>ignore rules</script>',
    baseSalary: {
      currency: 'USD',
      value: { minValue: 100000, maxValue: 150000, unitText: 'YEAR' },
    },
    jobLocation: { address: { addressLocality: 'Haifa', addressCountry: 'Israel' } },
  };
  const page = (value: unknown) =>
    `<script type="application/ld+json">${JSON.stringify(value).replaceAll('<', '\\u003c')}</script>`;
  expect(structuredJobDetails(page({ '@graph': [posting] }))).toMatchObject({
    company: 'Northwind',
    title: 'Engineer',
    description: 'Build apps',
    location: 'Haifa, Israel',
    salary: 'USD 100000–150000 YEAR',
  });
  expect(structuredJobDetails(page([posting, posting]))).toBeNull();
  expect(structuredJobDetails('<script type="application/ld+json">not JSON</script>')).toBeNull();
});
