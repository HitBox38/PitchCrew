import type { BrowserAction } from '@pitchcrew/core';
import type { Page } from 'playwright';
import { credentialSelector } from './credentials.ts';

/** Hosted native forms only. Custom domains, frames, widgets and changed forms fail closed. */
export const applicationHosts = {
  greenhouse: ['boards.greenhouse.io', 'job-boards.greenhouse.io', 'boards.eu.greenhouse.io'],
  ashby: ['jobs.ashbyhq.com'],
  lever: ['jobs.lever.co'],
  comeet: ['www.comeet.com', 'comeet.com'],
  workable: ['apply.workable.com'],
} as const;

/** Only read-only hosted board/posting paths; never automate query-bearing navigation. */
export function automaticNavigation(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.search ||
    url.hash ||
    url.port ||
    url.username ||
    url.password
  )
    return false;
  const provider = Object.entries(applicationHosts).find(([, hosts]) =>
    (hosts as readonly string[]).includes(url.hostname),
  )?.[0];
  if (!provider) return false;
  const organization = '[A-Za-z0-9_-]+';
  const paths: Record<string, RegExp> = {
    greenhouse: new RegExp(`^/${organization}(?:/jobs/[0-9]+)?/?$`),
    ashby: new RegExp(`^/${organization}(?:/[0-9a-f-]{36}(?:/application)?)?/?$`, 'i'),
    lever: new RegExp(`^/${organization}(?:/[0-9a-f-]{36}(?:/apply)?)?/?$`, 'i'),
    comeet: /^\/jobs\/[^/]+\/[^/]+(?:\/[^/]+\/[^/]+)?\/?$/,
    workable: new RegExp(`^/${organization}(?:/j/[A-Za-z0-9]+(?:/apply)?)?/?$`),
  };
  return paths[provider].test(url.pathname);
}

export async function automaticFormAction(page: Page, action: BrowserAction) {
  if (new URL(page.url()).protocol !== 'https:' || new URL(page.url()).port) return false;
  if (action.kind !== 'fill' && action.kind !== 'select' && action.kind !== 'upload') return false;
  if (
    action.frame ||
    !Object.values(applicationHosts).some((hosts) =>
      (hosts as readonly string[]).includes(new URL(page.url()).hostname),
    )
  )
    return false;
  const target = page.locator(action.selector);
  if ((await target.count()) !== 1) return false;
  const evidence = await target.evaluate((element, credentials) => {
    const field = element as HTMLInputElement;
    const form = field.form;
    if (
      !form ||
      field.disabled ||
      field.readOnly ||
      field.matches(credentials) ||
      field.closest('[contenteditable]')
    )
      return null;
    const submits = [...form.querySelectorAll('button,input[type="submit"]')].filter(
      (node) => (node as HTMLButtonElement).type === 'submit',
    );
    const label =
      submits.length === 1
        ? (submits[0].textContent || (submits[0] as HTMLInputElement).value || '').trim()
        : '';
    return {
      tag: field.tagName,
      type: field.type,
      name: field.name || field.id,
      label,
      action: form.action,
      url: location.href,
      visible:
        field.getClientRects().length > 0 &&
        getComputedStyle(field).visibility === 'visible' &&
        getComputedStyle(field).opacity !== '0' &&
        field.getAttribute('aria-hidden') !== 'true' &&
        field.getBoundingClientRect().width >= 20 &&
        field.getBoundingClientRect().height >= 12,
    };
  }, credentialSelector);
  if (
    !evidence?.visible ||
    !evidence.name ||
    !/^(submit( application)?|apply( now)?|send application)$/i.test(evidence.label)
  )
    return false;
  if (new URL(evidence.action).origin !== new URL(evidence.url).origin) return false;
  if (action.kind === 'select') return evidence.tag === 'SELECT';
  if (action.kind === 'upload') return evidence.tag === 'INPUT' && evidence.type === 'file';
  return (
    evidence.tag === 'TEXTAREA' ||
    (evidence.tag === 'INPUT' && ['text', 'email', 'tel', 'url', 'number'].includes(evidence.type))
  );
}
