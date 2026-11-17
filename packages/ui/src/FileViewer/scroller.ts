/**
 * The element that actually scrolls the current file: the Word preview's frame, a zoomed image's
 * own viewport, or the document region itself for PDF, Markdown and text.
 */
export const scrollerOf = (body: HTMLElement | null, root: HTMLElement | null) =>
  root && root.ownerDocument !== document
    ? root.ownerDocument.scrollingElement
    : (body?.querySelector('.file-image-viewport') ?? body);

export interface ScrollPosition {
  top: number;
  left: number;
}
export const readScroll = (element: Element): ScrollPosition => ({
  top: element.scrollTop,
  left: element.scrollLeft,
});
export const applyScroll = (element: Element | null | undefined, position?: ScrollPosition) => {
  if (!element) return;
  element.scrollTop = position?.top ?? 0;
  element.scrollLeft = position?.left ?? 0;
};
