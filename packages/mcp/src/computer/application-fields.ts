import type { BrowserAction } from '@pitchcrew/core';
import type { Page } from 'playwright';
import { credentialSelector } from './credentials.ts';
import { hash } from './helpers.ts';
import { normalizedValue } from './application-values.ts';

/** Private manual input fingerprints stay in this browser's memory, never in events or prompts. */
export async function captureManualField(page: Page, manual: Set<string>) {
  for (const frame of page.frames()) {
    const field = await frame
      .evaluate(() => {
        const target = document.activeElement;
        if (
          !(
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target instanceof HTMLSelectElement
          )
        )
          return null;
        const index = Array.from(document.querySelectorAll('input,textarea,select')).indexOf(
          target,
        );
        return { index, name: target.name, id: target.id, value: target.value };
      })
      .catch(() => null);
    if (field)
      manual.add(
        hash({
          url: frame.url(),
          index: field.index,
          name: field.name,
          id: field.id,
          value: normalizedValue(field.value),
        }),
      );
  }
}
export async function validateApplicationFields(
  page: Page,
  action: BrowserAction,
  values: readonly string[],
  manual: Set<string>,
) {
  if (action.kind === 'navigate' || action.kind === 'dialog' || action.kind === 'upload') return;
  const target = action.frame
    ? page.frameLocator(action.frame).locator(action.selector)
    : page.locator(action.selector);
  const targets =
    action.kind === 'fill' || action.kind === 'select'
      ? [target]
      : page.frames().map((frame) => frame.locator('body'));
  const fields = (
    await Promise.all(
      targets.map((target) =>
        target.evaluate(
          (element, args) => {
            const root = element.closest('form') ?? element.ownerDocument.body;
            const fields =
              args.action.kind === 'fill' || args.action.kind === 'select'
                ? [element]
                : Array.from(root.querySelectorAll('input,textarea,select'));
            return fields.flatMap((field) => {
              if (
                !(
                  field instanceof HTMLInputElement ||
                  field instanceof HTMLTextAreaElement ||
                  field instanceof HTMLSelectElement
                )
              ) {
                if (args.action.kind === 'fill')
                  throw new Error('Application text must use an inspected native field.');
                return [];
              }
              if (
                field.disabled ||
                field.matches(args.credentials) ||
                (field instanceof HTMLInputElement &&
                  [
                    'hidden',
                    'file',
                    'checkbox',
                    'radio',
                    'button',
                    'submit',
                    'reset',
                    'image',
                  ].includes(field.type))
              )
                return [];
              const value =
                args.action.kind === 'fill' || args.action.kind === 'select'
                  ? args.action.value
                  : field.value;
              const label =
                field instanceof HTMLSelectElement
                  ? (Array.from(field.options).find((option) => option.value === value)?.text ?? '')
                  : '';
              return [
                {
                  url: field.ownerDocument.URL,
                  index: Array.from(
                    field.ownerDocument.querySelectorAll('input,textarea,select'),
                  ).indexOf(field),
                  name: field.name,
                  id: field.id,
                  value,
                  label,
                },
              ];
            });
          },
          { action, credentials: credentialSelector },
        ),
      ),
    )
  ).flat();
  const allowed = new Set(values.map(normalizedValue));
  for (const field of fields) {
    const value = normalizedValue(field.value);
    if (
      !value ||
      allowed.has(value) ||
      (field.label && allowed.has(normalizedValue(field.label))) ||
      manual.has(
        hash({ url: field.url, index: field.index, name: field.name, id: field.id, value }),
      )
    )
      continue;
    throw new Error(
      'Application field contains an unreviewed answer. Save your answer in the confirmed brief or enter it privately with manual takeover.',
    );
  }
}
