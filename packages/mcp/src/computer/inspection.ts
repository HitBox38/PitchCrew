import type { FormControl } from '@pitchcrew/core';
import type { Page } from 'playwright';

export async function inspectControls(page: Page) {
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
      const evidence = await frame.evaluate(() => ({
        html: document.documentElement.outerHTML,
        controls: Array.from(document.querySelectorAll('input,textarea,select'))
          .slice(0, 100)
          .map((element, index) => {
            const field = element as HTMLInputElement;
            return {
              selector: `:nth-match(:is(input,textarea,select), ${index + 1})`,
              label: (
                field.labels?.[0]?.textContent ??
                field.getAttribute('aria-label') ??
                field.name ??
                ''
              )
                .trim()
                .slice(0, 500),
              type: field.type || field.tagName.toLowerCase(),
              required: field.required || field.getAttribute('aria-required') === 'true',
              visible:
                field.getClientRects().length > 0 &&
                getComputedStyle(field).visibility !== 'hidden',
              disabled: field.disabled,
              accept: field.getAttribute('accept') ?? '',
              options:
                field.tagName === 'SELECT'
                  ? Array.from((element as HTMLSelectElement).options)
                      .map((option) => option.text)
                      .slice(0, 100)
                  : [],
            };
          }),
        values: Array.from(document.querySelectorAll('input,textarea,select')).map((element) => {
          const field = element as HTMLInputElement;
          return { value: field.value, checked: field.checked };
        }),
        overflow: document.querySelectorAll('input,textarea,select').length > 100,
      }));
      const text = await frame.locator('body').ariaSnapshot();
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
}
