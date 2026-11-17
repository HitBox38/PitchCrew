import type { BrowserAction } from '@pitchcrew/core';
import type { Page } from 'playwright';
import type { ActionTarget } from './access-modes.ts';
import { credentialSelector } from './credentials.ts';

/** Elements an action on a nested node activates: the button around an icon, a field's label. */
const activatable =
  'a[href],button,input,select,textarea,summary,label,[role="button"],[role="link"],[role="checkbox"],[role="radio"],[role="switch"],[role="tab"],[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"],[role="option"],[role="textbox"],[role="searchbox"],[role="combobox"],[contenteditable=""],[contenteditable="true"],[contenteditable="plaintext-only"]';

/**
 * Elements with the browser's own activation behaviour: a click anywhere inside one activates it,
 * whatever ARIA role an element between them claims.
 */
const native =
  'button,input[type="submit" i],input[type="image" i],input[type="reset" i],input[type="button" i],input[type="checkbox" i],input[type="radio" i],a[href],area[href],label,summary';

/** Documents the server cannot read from the page: a click on one lands in another document. */
const embedded = 'iframe,frame,object,embed';

/** Controls inside a clicked element that the server still judges one by one. */
const nestedLimit = 40;

/**
 * What activating the element an action targets would do, read in the page without running its
 * scripts or interacting. Undefined when the selector does not name exactly one element.
 */
export const readActionTarget = async (
  page: Page,
  action: BrowserAction,
): Promise<ActionTarget | undefined> => {
  if (!('selector' in action)) return undefined;
  try {
    const frame = action.frame ? page.frameLocator(action.frame) : page;
    const locator = frame.locator(action.selector);
    if ((await locator.count()) !== 1) return undefined;
    return await locator.evaluate(
      (node, { credentials, selector, nativeSelector, embeddedSelector, limit }): ActionTarget => {
        const text = (value: string | null | undefined) =>
          (value ?? '').replace(/\s+/g, ' ').trim();
        /** Elements under a root, including those in every open shadow root inside it. */
        const composed = (root: Element, match: string, max: number) => {
          const found: Element[] = [];
          const walk = (scope: Element | ShadowRoot) => {
            for (const element of scope.querySelectorAll('*')) {
              if (found.length > max) return;
              if (element.matches(match)) found.push(element);
              if (element.shadowRoot) walk(element.shadowRoot);
            }
          };
          if (root.shadowRoot) walk(root.shadowRoot);
          walk(root);
          return found;
        };
        const describe = (start: Element, owned = false): ActionTarget => {
          let element = start as HTMLElement;
          if (element instanceof HTMLLabelElement && element.control) element = element.control;
          const tag = element.tagName.toLowerCase();
          const type = (element.getAttribute('type') ?? '').trim().toLowerCase();
          const role = (element.getAttribute('role') ?? '').trim().toLowerCase();
          const input = element as HTMLInputElement;
          const field = tag === 'input' || tag === 'select' || tag === 'textarea';
          const href = tag === 'a' ? (element.getAttribute('href') ?? '').trim() : '';
          // A link to nothing, a fragment or script runs the page's code like a button.
          const navigates = !!href && !href.startsWith('#') && !/^javascript:/i.test(href);
          // Rails and Turbo send these links as a POST (or PUT, PATCH, DELETE) form.
          const linkMethod = text(
            element.getAttribute('data-turbo-method') ?? element.getAttribute('data-method'),
          ).toLowerCase();
          const kind = (): ActionTarget['control'] => {
            if (tag === 'button')
              return type === 'reset' ? 'reset' : type === 'button' ? 'button' : 'submit';
            if (tag === 'input') {
              if (type === 'submit' || type === 'image') return 'submit';
              if (type === 'reset') return 'reset';
              if (type === 'button') return 'button';
              return type === 'checkbox' || type === 'radio' ? 'choice' : 'field';
            }
            if (tag === 'a' && linkMethod && linkMethod !== 'get') return 'submit';
            if (tag === 'select') return 'field';
            if (tag === 'textarea' || element.isContentEditable) return 'multiline';
            if (tag === 'a' && navigates) return 'link';
            if (['textbox', 'searchbox', 'combobox', 'spinbutton', 'slider'].includes(role))
              return 'field';
            if (['checkbox', 'radio', 'switch', 'option'].includes(role)) return 'choice';
            if (tag === 'summary' || ['tab', 'menuitemcheckbox', 'menuitemradio'].includes(role))
              return 'toggle';
            return tag === 'a' || ['button', 'link', 'menuitem'].includes(role)
              ? 'button'
              : 'other';
          };
          const control = kind();
          const labelled = (element.getAttribute('aria-labelledby') ?? '')
            .split(/\s+/)
            .map((id) => (id ? (element.ownerDocument.getElementById(id)?.textContent ?? '') : ''))
            .join(' ');
          // An input button shows its value, or the browser's own default label.
          const value =
            tag === 'input' && ['submit', 'image', 'reset', 'button'].includes(type)
              ? input.value ||
                input.alt ||
                (type === 'submit' || type === 'image' ? 'Submit' : type === 'reset' ? 'Reset' : '')
              : '';
          const labels =
            field && input.labels
              ? [...input.labels].map((label) => label.textContent).join(' ')
              : '';
          // Every name the element shows or announces: a misleading label cannot hide another.
          const names = [
            element.getAttribute('aria-label'),
            labelled,
            value,
            labels,
            field ? '' : element.textContent,
            // A web component's own label may live in its open shadow root.
            field ? '' : element.shadowRoot?.textContent,
            element.getAttribute('title'),
            element.getAttribute('alt'),
            field ? element.getAttribute('placeholder') : '',
          ]
            .map((candidate) => text(candidate).slice(0, 300))
            .filter(Boolean);
          const owner =
            'form' in element && (element as HTMLButtonElement).form
              ? (element as HTMLButtonElement).form!
              : element.closest('form');
          const method = text(
            (control === 'submit' ? element.getAttribute('formmethod') : null) ??
              owner?.getAttribute('method'),
          ).toLowerCase();
          // A small form: a few short entries and no files, long answers or contact details.
          const entries = owner
            ? [...owner.querySelectorAll('input,select,textarea')].filter(
                (item) =>
                  !['hidden', 'submit', 'button', 'reset', 'image', 'checkbox', 'radio'].includes(
                    (item.getAttribute('type') ?? '').trim().toLowerCase(),
                  ),
              )
            : [];
          const small =
            !!owner &&
            entries.length <= 3 &&
            !owner.querySelector(
              'input[type="file" i],textarea,input[type="email" i],input[type="tel" i],input[type="password" i]',
            );
          // A site search is a landmark, or a small form with a box typed or named as one.
          const search =
            !!owner &&
            (owner.getAttribute('role') === 'search' ||
              !!owner.closest('[role="search"]') ||
              (small &&
                entries.some(
                  (item) =>
                    (item.getAttribute('type') ?? '').toLowerCase() === 'search' ||
                    /^(?:q|query|search|keywords?|search_?terms?)$/i.test(
                      item.getAttribute('name') || item.id || '',
                    ),
                )));
          const form = (): ActionTarget['form'] => {
            if (tag === 'a' && control === 'submit') return 'post';
            if (!owner) return '';
            if (method === 'post' || method === 'dialog') return method;
            if (search) return 'search';
            // Without an explicit GET, or with its own submit handler, the page's code sends it.
            return method === 'get' && !owner.hasAttribute('onsubmit') ? 'get' : 'script';
          };
          // The address a GET form opens, read from attributes: a field named "action" can hide
          // the form's own property. One that cannot be resolved is left empty, which asks.
          const opens = () => {
            try {
              return new URL(
                (control === 'submit' ? element.getAttribute('formaction') : null) ??
                  owner?.getAttribute('action') ??
                  '',
                element.baseURI,
              ).href;
            } catch {
              return '';
            }
          };
          const kindOfForm = form();
          // Enter in a field activates its form's default button: the first submit control.
          const fallback =
            !owned && owner && (control === 'field' || control === 'choice')
              ? [...owner.elements].find(
                  (item) =>
                    (item instanceof HTMLButtonElement && item.type === 'submit') ||
                    (item instanceof HTMLInputElement && ['submit', 'image'].includes(item.type)),
                )
              : undefined;
          return {
            control,
            name: names[0] ?? '',
            names,
            value:
              control === 'choice' ? text(input.value ?? element.getAttribute('value') ?? '') : '',
            href:
              control === 'link'
                ? (element as HTMLAnchorElement).href
                : kindOfForm === 'get'
                  ? opens()
                  : '',
            form: kindOfForm,
            small,
            credential: element.matches(credentials),
            ...(fallback ? { defaultButton: describe(fallback, true) } : {}),
          };
        };
        const element = node.closest(selector) ?? node;
        const target = describe(element);
        // The browser activates the nearest element with native activation behaviour, even when
        // an element with an ARIA role sits between it and the click.
        const enclosing: Element[] = [];
        for (let current: Element | null = node; current;) {
          if (current !== element && current.matches(nativeSelector)) enclosing.push(current);
          const root = current.getRootNode();
          current = current.parentElement ?? (root instanceof ShadowRoot ? root.host : null);
        }
        const around = enclosing.length
          ? { enclosing: enclosing.map((item) => describe(item, true)) }
          : {};
        // A field's own options and a label's control are the field.
        if (target.control === 'field' || target.control === 'multiline')
          return { ...target, ...around };
        // A click on an embedded document lands in a page the server cannot read.
        const unreadable =
          element.matches(embeddedSelector) || composed(element, embeddedSelector, 0).length > 0;
        const inside = unreadable
          ? []
          : composed(element, selector, limit).filter(
              (item) => !(item instanceof HTMLLabelElement && item.control === element),
            );
        return {
          ...target,
          ...around,
          nested:
            unreadable || inside.length > limit ? null : inside.map((item) => describe(item, true)),
        };
      },
      {
        credentials: credentialSelector,
        selector: activatable,
        nativeSelector: native,
        embeddedSelector: embedded,
        limit: nestedLimit,
      },
    );
  } catch {
    return undefined;
  }
};
