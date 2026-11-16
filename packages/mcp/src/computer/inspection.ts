import type { FormControl } from '@pitchcrew/core';
import type { Page } from 'playwright';
import { credentialSelector, redactCredentials } from './credentials.ts';
import { readFormControls } from './form-controls.ts';

export const inspectControls = async (page: Page) => {
  const controls: FormControl[] = [];
  const frames: unknown[] = [];
  const texts: string[] = [];
  const uninspected: string[] = [];
  for (const frame of page.frames()) {
    let frameSelector: string | undefined;
    if (frame !== page.mainFrame()) {
      if (frame.parentFrame() !== page.mainFrame()) {
        uninspected.push(`Nested frame: ${frame.url()}`);
        continue;
      }
      const handle = await frame.frameElement();
      const index = await handle.evaluate((el) =>
        Array.from(document.querySelectorAll('iframe,frame')).indexOf(el as HTMLIFrameElement),
      );
      frameSelector = `:nth-match(:is(iframe,frame), ${index + 1})`;
    }
    try {
      const evidence = await frame.evaluate(readFormControls, credentialSelector);
      const secrets = await frame
        .locator(credentialSelector)
        .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
      const text = redactCredentials(await frame.locator('body').ariaSnapshot(), secrets);
      texts.push(text);
      frames.push({ url: frame.url(), text, ...evidence });
      controls.push(
        ...evidence.controls.map((control) => ({
          ...control,
          ...(frameSelector ? { frame: frameSelector } : {}),
        })),
      );
      if (evidence.overflow) uninspected.push(`More than 100 controls in ${frame.url()}`);
    } catch {
      uninspected.push(`Unavailable frame: ${frame.url()}`);
    }
  }
  return { controls, frames, uninspected, text: texts.join('\n').slice(0, 30000) };
};
