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
    if (frame !== page.mainFrame() && frame.parentFrame() !== page.mainFrame()) {
      uninspected.push(`Nested frame: ${frame.url()}`);
      continue;
    }
    let evidence: ReturnType<typeof readFormControls> | undefined;
    try {
      let frameSelector: string | undefined;
      if (frame !== page.mainFrame()) {
        const handle = await frame.frameElement();
        try {
          const index = await handle.evaluate((el) =>
            Array.from(document.querySelectorAll('iframe,frame')).indexOf(el as HTMLIFrameElement),
          );
          if (index < 0) throw new Error('Frame is no longer addressable.');
          frameSelector = `:nth-match(:is(iframe,frame), ${index + 1})`;
        } finally {
          await handle.dispose();
        }
      }
      evidence = await frame.evaluate(readFormControls, credentialSelector);
      controls.push(
        ...evidence.controls.map((control) => ({
          ...control,
          ...(frameSelector ? { frame: frameSelector } : {}),
        })),
      );
      if (evidence.overflow) uninspected.push(`More than 100 controls in ${frame.url()}`);
    } catch {
      uninspected.push(`Unavailable frame controls: ${frame.url()}`);
    }
    let text: string | undefined;
    try {
      const secrets = await frame
        .locator(credentialSelector)
        .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
      // A widget may mount another body in a shadow tree. Read the actual document root.
      text = redactCredentials(await frame.locator(':root').ariaSnapshot(), secrets);
      texts.push(text);
    } catch {
      uninspected.push(`Unavailable frame text: ${frame.url()}`);
    }
    frames.push({ url: frame.url(), text, ...evidence });
  }
  return { controls, frames, uninspected, text: texts.join('\n').slice(0, 30000) };
};
