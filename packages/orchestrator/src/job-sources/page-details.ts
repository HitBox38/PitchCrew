import { jobLinkDetails } from '@pitchcrew/core';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import { htmlToText } from './html.ts';
import { microdataJobPostings } from './microdata.ts';

const salaryText = (value: unknown): string => {
  if (typeof value === 'string') return text(value, 100);
  const salary = object(value);
  const range = object(salary.value);
  const number = (amount: unknown) =>
    typeof amount === 'number' && Number.isFinite(amount) ? String(amount) : '';
  const exact = number(salary.value) || number(range.value);
  const min = number(range.minValue);
  const max = number(range.maxValue);
  const amount =
    exact || (min && max ? `${min}–${max}` : min ? `from ${min}` : max ? `up to ${max}` : '');
  if (!amount) return '';
  return [text(salary.currency, 10), amount, text(range.unitText, 20)]
    .filter(Boolean)
    .join(' ')
    .slice(0, 100);
};

/** Only an unambiguous schema.org JobPosting supplies automatic card fields. */
export const structuredJobDetails = (html: string) => {
  const root = parse(html);
  const nodes: Node[] = [root];
  const postings: Record<string, unknown>[] = [];
  while (nodes.length) {
    const node = nodes.pop()!;
    if (
      'tagName' in node &&
      node.tagName === 'script' &&
      node.attrs.some(
        ({ name, value }) => name === 'type' && value.toLowerCase() === 'application/ld+json',
      )
    ) {
      const body = node.childNodes.map((child) => ('value' in child ? child.value : '')).join('');
      try {
        const pending: unknown[] = [JSON.parse(body)];
        while (pending.length) {
          const item = pending.pop();
          if (Array.isArray(item)) {
            pending.push(...item);
            continue;
          }
          const record = object(item);
          const types = Array.isArray(record['@type']) ? record['@type'] : [record['@type']];
          if (
            types.some((type) => type === 'JobPosting' || type === 'https://schema.org/JobPosting')
          )
            postings.push(record);
          if (record['@graph']) pending.push(record['@graph']);
        }
      } catch {
        /* Malformed metadata leaves extraction to the agent. */
      }
    }
    if ('childNodes' in node) nodes.push(...node.childNodes);
  }
  const microdata = microdataJobPostings(root);
  if (microdata.length > 1) return null;
  if (!postings.length) postings.push(...microdata);
  if (postings.length !== 1) return null;
  if (microdata[0]?.title && text(microdata[0].title, 160) !== text(postings[0]!.title, 160))
    return null;
  const posting = postings[0]!;
  const rawLocations = Array.isArray(posting.jobLocation)
    ? posting.jobLocation
    : [posting.jobLocation];
  const locations = rawLocations
    .map((location) => {
      const address = object(object(location).address);
      return [address.addressLocality, address.addressRegion, address.addressCountry]
        .map((value) => text(value, 80))
        .filter(Boolean)
        .join(', ');
    })
    .filter(Boolean);
  const parsed = jobLinkDetails.safeParse({
    company: text(
      typeof posting.hiringOrganization === 'string'
        ? posting.hiringOrganization
        : object(posting.hiringOrganization).name,
      100,
    ),
    title: text(posting.title, 160),
    location: (
      locations.join('; ') || (posting.jobLocationType === 'TELECOMMUTE' ? 'Remote' : '')
    ).slice(0, 120),
    salary: salaryText(posting.baseSalary),
    description: [
      ...new Set(
        [posting.description, posting.responsibilities, posting.qualifications]
          .flatMap((value) => (Array.isArray(value) ? value : [value]))
          .map((value) => text(value, 20_000))
          .filter(Boolean),
      ),
    ]
      .join('\n\n')
      .slice(0, 20_000),
  });
  return parsed.success ? parsed.data : null;
};

type Node = DefaultTreeAdapterMap['node'];
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const text = (value: unknown, limit: number) =>
  typeof value === 'string' ? htmlToText(value).slice(0, limit) : '';
