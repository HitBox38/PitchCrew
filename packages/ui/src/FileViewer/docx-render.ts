/** Frames this wide or narrower reflow Word pages to their width, so no fit mode applies. */
export const narrowFrame = 640;
export const renderDocx = async (bytes: string, signal: AbortSignal) => {
  const { renderAsync } = await import('docx-preview');
  signal.throwIfAborted();
  // Keep document styles outside the workspace. Only embedded images may load in the preview.
  const preview = document.implementation.createHTMLDocument('DOCX preview');
  await renderAsync(
    Uint8Array.from(atob(bytes), (character) => character.charCodeAt(0)),
    preview.body,
    preview.head,
    {
      useBase64URL: true,
      ignoreFonts: true,
      // Each section keeps at least its page height, so Word pages read as paper.
      ignoreHeight: false,
      renderAltChunks: false,
      renderComments: false,
      experimental: false,
    },
  );
  signal.throwIfAborted();
  if (!preview.body.querySelector('section.docx')) throw new Error('Document has no pages.');
  // Links remain readable, but previewing a packet must never navigate to its content.
  for (const link of preview.body.querySelectorAll('a')) {
    link.removeAttribute('href');
    link.removeAttribute('target');
  }
  const policy = preview.createElement('meta');
  policy.httpEquiv = 'Content-Security-Policy';
  policy.content =
    "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'";
  preview.head.prepend(policy);
  const style = preview.createElement('style');
  // Pages sit on the host's reading tray: a transparent canvas (the frame shares this light
  // colour scheme, so the browser paints no backdrop) with the viewer's paper shadow. The host
  // sets the gutters on the root, outside the zoomed body, so they never scale with the page.
  style.textContent = `
    html { color-scheme: light; background: transparent; box-sizing: border-box; }
    body { margin: 0; background: transparent; }
    .docx-wrapper { padding: 0; background: transparent !important; }
    .docx-wrapper > section.docx {
      margin: 0 auto 24px;
      box-shadow: 0 0 0 1px rgb(20 22 30 / 0.06), 0 1px 2px rgb(20 22 30 / 0.06), 0 12px 32px -12px rgb(20 22 30 / 0.24);
    }
    @media (max-width: ${narrowFrame}px) {
      /* Phones reflow each page to the frame instead of shrinking it to its longest line. */
      .docx-wrapper { align-items: stretch !important; }
      .docx-wrapper > section.docx {
        box-sizing: border-box; width: 100% !important; min-height: auto !important;
        aspect-ratio: var(--page-ratio, 8.5 / 11); padding: 24px !important; overflow: visible !important;
      }
    }
  `;
  preview.head.append(style);
  return `<!doctype html>${preview.documentElement.outerHTML}`;
};
