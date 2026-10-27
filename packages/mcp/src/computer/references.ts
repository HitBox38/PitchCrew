import { randomUUID } from 'node:crypto';
import type { ElementHandle, Page } from 'playwright';
import type { BrowserAction, BrowserElement } from '@pitchcrew/core';
import { credentialSelector, redactCredentials } from './credentials.ts';

const candidates = 'body,a,button,input,textarea,select,[role],[tabindex]';
export const browserReferences = () => {
  const entries = new Map<string, { selector: string; frame?: string; handle: ElementHandle }>();
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
        entries.set(ref, { selector, frame: frameSelector, handle });
        result.push({
          ref,
          ...element,
          name: redactCredentials(element.name, secrets),
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
