import type { KeyboardEvent } from 'react';
import type { FileViewerModel } from './useFileViewer.ts';
import { scrollByKey } from '../scroll-keys.ts';

/**
 * Viewer shortcuts: Find, Escape closing Find before the viewer, and zoom in/out/reset. Keys from
 * menus and popovers portaled out of the dialog, or on the trigger of an open one, are theirs,
 * so Escape closes them first.
 */
export const viewerKeyDown = (model: FileViewerModel) => (event: KeyboardEvent<HTMLElement>) => {
  if (!event.currentTarget.contains(event.target as Node)) return;
  const modified = event.metaKey || event.ctrlKey;
  // The Word preview and a zoomed image scroll inside their own element, so the focused document
  // region forwards keys to it, found from the region itself so keys work as soon as it shows.
  const target = event.target as HTMLElement;
  const inner = target.classList.contains('file-view-body')
    ? (target.querySelector('iframe')?.contentDocument?.scrollingElement ??
      target.querySelector('.file-image-viewport'))
    : null;
  if (inner && !modified) scrollByKey(inner, event);
  // Images have no searchable text, but ⌘F must not open the browser's own find over the app.
  if (modified && event.key.toLowerCase() === 'f') {
    event.preventDefault();
    if (model.file.kind !== 'image') model.openFind();
  }
  // A menu open from its trigger owns Escape even while focus is still on the trigger, and a
  // half-typed page number cancels its draft before Escape closes Find.
  const owned =
    (event.target as HTMLElement).getAttribute('aria-expanded') === 'true' ||
    (event.target as HTMLElement).hasAttribute('data-draft');
  if (event.key === 'Escape' && model.findOpen && !owned) {
    event.preventDefault();
    event.stopPropagation();
    model.closeFind();
  }
  // Zoom keys are not text-entry shortcuts: inside the viewer they always zoom the file, never the app.
  if (modified) {
    if (['+', '=', '-'].includes(event.key)) {
      event.preventDefault();
      model.zoom.zoomBy(event.key === '-' ? -1 : 1);
    }
    if (event.key === '0') {
      event.preventDefault();
      model.zoom.resetZoom();
    }
  }
};
