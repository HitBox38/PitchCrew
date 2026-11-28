import type { FormControl } from '@pitchcrew/core';

/** Serialized into each inspected frame; no page handlers or validation methods are invoked. */
export const readFormControls = (credentials: string) => {
  const native = 'input,textarea,select';
  const custom = '[role="radio"],[role="checkbox"],button[aria-pressed]';
  const secrets = Array.from(document.querySelectorAll<HTMLInputElement>(credentials))
    .map((field) => field.value)
    .filter(Boolean);
  const redact = (text: string) =>
    secrets.reduce((value, secret) => value.split(secret).join('[hidden]'), text);
  const text = (value: string) => redact(value).trim().slice(0, 500);
  const content = (element: Element | null) => {
    if (!element) return '';
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const parts: string[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.parentElement?.closest(native)) parts.push(node.textContent ?? '');
    }
    return parts.join('');
  };
  const name = (element: Element) => {
    const labelledBy = element
      .getAttribute('aria-labelledby')
      ?.trim()
      .split(/\s+/)
      .slice(0, 10)
      .map((id) => content(document.getElementById(id)))
      .join(' ')
      .trim();
    return labelledBy || element.getAttribute('aria-label')?.trim() || '';
  };
  const attribute = (
    element: Element,
    key: string,
  ): NonNullable<FormControl['constraints']>['min'] => {
    const value = element.getAttribute(key);
    if (value === null) return { status: 'absent' };
    if (value.length > 200 || secrets.some((secret) => value.includes(secret)))
      return { status: 'unavailable' };
    return { status: 'declared', value };
  };
  const choiceState = (value: string | null, mixed = true) =>
    value === 'true'
      ? true
      : value === 'false'
        ? false
        : mixed && value === 'mixed'
          ? 'mixed'
          : undefined;
  const entries = [native, custom].flatMap((selector) =>
    Array.from(document.querySelectorAll(selector))
      .map((element, index) => ({
        element,
        selector: `:nth-match(:is(${selector}), ${index + 1})`,
      }))
      .filter(({ element }) => selector === native || !element.matches(native)),
  );
  const controls: FormControl[] = entries.slice(0, 100).map(({ element, selector }) => {
    const field = element as HTMLInputElement;
    const role = element.getAttribute('role');
    const parent = element.parentElement?.closest('fieldset,[role="group"],[role="radiogroup"]');
    const groupRole =
      parent?.getAttribute('role') ?? (parent?.tagName === 'FIELDSET' ? 'fieldset' : undefined);
    const group: FormControl['group'] =
      parent && (groupRole === 'fieldset' || groupRole === 'group' || groupRole === 'radiogroup')
        ? {
            role: groupRole,
            label: text(
              name(parent) ||
                (groupRole === 'fieldset' ? content(parent.querySelector(':scope > legend')) : ''),
            ),
            required:
              groupRole === 'radiogroup' &&
              ['true', 'false'].includes(parent.getAttribute('aria-required') ?? '')
                ? parent.getAttribute('aria-required') === 'true'
                : null,
          }
        : undefined;
    const options = element instanceof HTMLSelectElement ? Array.from(element.options) : undefined;
    return {
      selector,
      label: text(
        name(element) ||
          Array.from(field.labels ?? [], (label) => content(label).trim())
            .filter(Boolean)
            .join(' ') ||
          (element.matches(custom) ? content(element).trim() : '') ||
          element.getAttribute('title')?.trim() ||
          field.name ||
          '',
      ),
      type:
        role === 'radio' || role === 'checkbox'
          ? role
          : element.matches('button[aria-pressed]')
            ? 'toggle'
            : field.type || element.tagName.toLowerCase(),
      ...(element instanceof HTMLButtonElement ? { buttonType: element.type } : {}),
      ...(role === 'radio' || role === 'checkbox'
        ? { checked: choiceState(element.getAttribute('aria-checked'), role === 'checkbox') }
        : {}),
      ...(element.matches('button[aria-pressed]')
        ? { pressed: choiceState(element.getAttribute('aria-pressed')) }
        : {}),
      required:
        !!field.required ||
        element.getAttribute('aria-required') === 'true' ||
        ((role === 'radio' || field.type === 'radio') && group?.required === true),
      visible:
        element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden',
      disabled: element.matches(':disabled') || !!element.closest('[aria-disabled="true"]'),
      accept: text(element.getAttribute('accept') ?? ''),
      ...(field.maxLength >= 0 ? { maxLength: field.maxLength } : {}),
      constraints: {
        minLength: attribute(element, 'minlength'),
        maxLength: attribute(element, 'maxlength'),
        min: attribute(element, 'min'),
        max: attribute(element, 'max'),
        step: attribute(element, 'step'),
        uploadSizeLimit: 'unknown',
      },
      options: options?.slice(0, 100).map((option) => text(option.text)) ?? [],
      ...(options
        ? {
            optionsTotal: options.length,
            optionsTruncated:
              options.length > 100 ||
              options.slice(0, 100).some((option) => redact(option.text).trim().length > 500),
          }
        : {}),
      ...(group ? { group } : {}),
    };
  });
  return {
    controls,
    overflow: entries.length > 100,
    // Private fingerprint inputs are read with the metadata and never returned to agents.
    html: document.documentElement.outerHTML,
    values: Array.from(document.querySelectorAll<HTMLInputElement>(native)).map((field) => ({
      value: field.value,
      checked: field.checked,
    })),
  };
};
