import type { ClipboardEvent } from 'react';
/** Use portable tokens when text selection includes complete reference chips. */
export function copyReferenceSelection(event: ClipboardEvent<HTMLElement>) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const fragment = selection.getRangeAt(0).cloneContents();
  if (!fragment.querySelector('[data-reference-token]')) return;
  fragment
    .querySelectorAll<HTMLElement>('[data-reference-token]')
    .forEach((element) =>
      element.replaceWith(
        document.createTextNode(element.dataset.referenceToken ?? element.textContent ?? ''),
      ),
    );
  function text(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    if (node instanceof HTMLElement && node.tagName === 'BR') return '\n';
    const value = Array.from(node.childNodes).map(text).join('');
    return node instanceof HTMLElement && ['P', 'LI', 'PRE', 'BLOCKQUOTE'].includes(node.tagName)
      ? `${value}\n`
      : value;
  }
  event.preventDefault();
  event.clipboardData.setData('text/plain', text(fragment).replace(/\n+$/, ''));
}
