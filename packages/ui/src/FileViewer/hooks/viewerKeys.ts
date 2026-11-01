import type { KeyboardEvent } from 'react';
import type { FileViewerModel } from './useFileViewer.ts';

/** Viewer shortcuts: Find, Escape closing Find before the viewer, and zoom in/out/reset. */
export const viewerKeyDown = (model: FileViewerModel) => (event: KeyboardEvent<HTMLElement>) => {
  if (
    (event.metaKey || event.ctrlKey) &&
    event.key.toLowerCase() === 'f' &&
    model.file.kind !== 'image'
  ) {
    event.preventDefault();
    model.openFind();
  }
  if (event.key === 'Escape' && model.findOpen) {
    event.preventDefault();
    event.stopPropagation();
    model.setFindOpen(false);
  }
  if (
    (event.metaKey || event.ctrlKey) &&
    !['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName)
  ) {
    if (['+', '=', '-'].includes(event.key)) {
      event.preventDefault();
      model.change({
        zoom: Math.max(25, Math.min(400, model.settings.zoom + (event.key === '-' ? -25 : 25))),
      });
    }
    if (event.key === '0') {
      event.preventDefault();
      model.change({ zoom: 100, fit: 'actual' });
    }
  }
};
