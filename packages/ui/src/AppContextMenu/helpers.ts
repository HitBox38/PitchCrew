export const selectedText = (target: EventTarget | null) => {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    if (target instanceof HTMLInputElement && target.type === 'password') return '';
    const { selectionStart, selectionEnd } = target;
    return selectionStart === null || selectionEnd === null
      ? ''
      : target.value.slice(selectionStart, selectionEnd);
  }
  const selection = window.getSelection();
  return target instanceof Node && selection?.containsNode(target, true)
    ? selection.toString()
    : '';
};

export const contextFocusTarget = (target: Element) =>
  target.closest<HTMLElement>(
    'input, textarea, [contenteditable]:not([contenteditable="false"]), button, a[href], [tabindex]',
  ) ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
