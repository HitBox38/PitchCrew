import { randomUUID } from 'node:crypto';
import type { ElementHandle, Page } from 'playwright';
import type { BrowserAction, BrowserElement } from '@pitchcrew/core';
import { credentialSelector, redactCredentials } from './credentials.ts';

const candidates = 'body,a,button,input,textarea,select,[role],[tabindex]';
export const browserReferences = () => {
  const entries = new Map<
    string,
    { selector: string; frame?: string; handle: ElementHandle; tag: string; name: string }
  >();
  const clear = () => {
    for (const entry of entries.values()) void entry.handle.dispose().catch(() => {});
    entries.clear();
  };
  const capture = async (page: Page): Promise<BrowserElement[]> => {
    clear();
    const generation = randomUUID();
    const result: BrowserElement[] = [];
    for (const frame of page.frames()) {
      if (frame !== page.mainFrame() && frame.parentFrame() !== page.mainFrame()) continue;
      let frameSelector: string | undefined;
      if (frame !== page.mainFrame()) {
        const element = await frame.frameElement();
        const index = await element.evaluate((el) =>
          Array.from(document.querySelectorAll('iframe,frame')).indexOf(el as HTMLIFrameElement),
        );
        frameSelector = `:nth-match(:is(iframe,frame), ${index + 1})`;
        await element.dispose();
      }
      const secrets = await frame
        .locator(credentialSelector)
        .evaluateAll((fields) => fields.map((field) => (field as HTMLInputElement).value));
      const count = Math.min(await frame.locator(candidates).count(), 200 - result.length);
      for (let index = 0; index < count; index++) {
        const selector = `:nth-match(:is(${candidates}), ${index + 1})`;
        const locator = frame.locator(selector);
        if (!(await locator.isVisible())) continue;
        const handle = await locator.elementHandle();
        if (!handle) continue;
        const element = await handle.evaluate((el) => ({
          tag: el.tagName.toLowerCase(),
          name: (el.getAttribute('aria-label') || el.textContent || el.getAttribute('name') || '')
            .trim()
            .slice(0, 120),
        }));
        const ref = `ref:${generation}:${result.length + 1}`;
        const name = redactCredentials(element.name, secrets);
        entries.set(ref, { selector, frame: frameSelector, handle, tag: element.tag, name });
        result.push({
          ref,
          ...element,
          name,
          ...(frameSelector ? { frame: frameSelector } : {}),
        });
      }
    }
    return result;
  };
  const target = async (page: Page, value: string, frame?: string) => {
    if (!value.startsWith('ref:')) return { selector: value, frame };
    const entry = entries.get(value);
    if (!entry || (frame && frame !== entry.frame))
      throw new Error('This element reference expired. Inspect the page again.');
    try {
      const locator = entry.frame
        ? page.frameLocator(entry.frame).locator(entry.selector)
        : page.locator(entry.selector);
      if (
        !(await locator.evaluate((element, expected) => element === expected, entry.handle, {
          timeout: 1000,
        }))
      )
        throw new Error('changed');
    } catch {
      throw new Error('This element reference changed. Inspect the page again.');
    }
    return { selector: entry.selector, frame: entry.frame };
  };
  return {
    clear,
    capture,
    target,
    /**
     * The tag and redacted visible name of a referenced element as it is now, for the approval
     * summary. Read at request time: the element may have been relabelled since inspection.
     */
    describe: async (page: Page, value: string) => {
      const entry = value.startsWith('ref:') ? entries.get(value) : undefined;
      if (!entry) return undefined;
      try {
        const frame = entry.frame ? page.frameLocator(entry.frame) : page;
        const secrets = await frame
          .locator(credentialSelector)
          .evaluateAll((fields) => fields.map((field) => (field as HTMLInputElement).value));
        const current = await entry.handle.evaluate((node) => {
          const el = node as Element;
          return {
            tag: el.tagName.toLowerCase(),
            name: (el.getAttribute('aria-label') || el.textContent || el.getAttribute('name') || '')
              .trim()
              .slice(0, 120),
          };
        });
        const name = redactCredentials(current.name, secrets);
        const box = await entry.handle.boundingBox().catch(() => null);
        const bounds =
          box && box.width > 0 && box.height > 0
            ? {
                x: Math.round(box.x),
                y: Math.round(box.y),
                width: Math.round(box.width),
                height: Math.round(box.height),
              }
            : undefined;
        return name || bounds
          ? { tag: current.tag, name, ...(bounds ? { bounds } : {}) }
          : undefined;
      } catch {
        return undefined;
      }
    },
    resolve: async (page: Page, action: BrowserAction): Promise<BrowserAction> => {
      if (!('selector' in action)) return action;
      const resolved = await target(page, action.selector, action.frame);
      if (action.kind !== 'drag') return { ...action, ...resolved };
      const destination = await target(page, action.targetSelector, action.frame);
      if (resolved.frame !== destination.frame)
        throw new Error('Drag targets must be in the same frame.');
      return { ...action, ...resolved, targetSelector: destination.selector };
    },
  };
};
