export async function renderDocx(bytes: string, signal: AbortSignal) {
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
      ignoreHeight: true,
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
  style.textContent = `
    html { color-scheme: light; }
    body { margin: 0; }
    .docx-wrapper { padding: 12px; background: #eee; }
    .docx-wrapper > section.docx { margin-bottom: 12px; }
    @media (max-width: 640px) {
      .docx-wrapper > section.docx { width: auto !important; padding: 24px !important; }
    }
  `;
  preview.head.append(style);
  return `<!doctype html>${preview.documentElement.outerHTML}`;
}
