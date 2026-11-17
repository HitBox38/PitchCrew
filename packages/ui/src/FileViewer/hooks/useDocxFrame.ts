import { useEffect, useRef, useState } from 'react';
import type { ViewerSettings } from '../types.ts';
import { fitScale } from '../zoom.ts';
import { readGutters } from '../gutters.ts';
import { narrowFrame } from '../docx-render.ts';
import { createPinch } from '../pinch.ts';
/** A Word section's declared page size in CSS pixels (docx-preview writes it in points). */
const declared = (page: HTMLElement) => {
  const pixels = (value: string) =>
    value.endsWith('pt') ? (parseFloat(value) * 4) / 3 : parseFloat(value) || 0;
  const width = pixels(page.style.width) || page.offsetWidth;
  return { width, height: pixels(page.style.minHeight) || width * (11 / 8.5) };
};
export const useDocxFrame = (
  settings: ViewerSettings,
  onRoot: (root: HTMLElement | null) => void,
  onFind: () => void,
  onEscape: () => void,
  onScale: (scale: number, fitted?: boolean) => void,
  /** Viewer zoom inside the frame: 1 in, −1 out, 0 reset; pinches pass their frame point. */
  onZoom: (direction: -1 | 0 | 1, point?: { x: number; y: number }) => void,
) => {
  const [revision, setRevision] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  const handlers = useRef({ onFind, onEscape, onZoom });
  useEffect(() => {
    handlers.current = { onFind, onEscape, onZoom };
  }, [onFind, onEscape, onZoom]);
  useEffect(() => {
    const target = frame.current;
    if (!target) return;
    const resize = () => {
      const doc = target.contentDocument;
      const page = doc?.querySelector<HTMLElement>('section.docx');
      if (!doc || !page) return;
      // Phones reflow pages to the frame; each keeps its declared proportion as a minimum.
      for (const section of doc.querySelectorAll<HTMLElement>('section.docx')) {
        const size = declared(section);
        section.style.setProperty('--page-ratio', `${size.width} / ${size.height}`);
      }
      const gutter = readGutters(target);
      doc.documentElement.style.padding = `${gutter.top}px ${gutter.x}px ${gutter.bottom}px`;
      // Narrow frames reflow each page to the frame (docx-render), so they keep natural size and
      // offer no fit modes.
      const reflowed = target.clientWidth <= narrowFrame;
      const fit = reflowed
        ? 1
        : fitScale(settings.fit, declared(page), {
            // The frame's own scrollbar is outside its root's client width.
            width: (doc.documentElement.clientWidth || target.clientWidth) - gutter.x * 2,
            height: target.clientHeight - gutter.top - gutter.bottom,
          });
      onScale(fit, !reflowed);
      doc.body.style.zoom = String((fit * settings.zoom) / 100);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(target);
    target.addEventListener('load', resize);
    resize();
    return () => {
      observer.disconnect();
      target.removeEventListener('load', resize);
    };
  }, [settings.zoom, settings.fit, revision, onScale]);
  const loaded = () => {
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    const style = doc.createElement('style');
    style.textContent =
      '::highlight(file-matches){background:#f5d87b;color:#222}::highlight(file-active-match){background:#e99638;color:#111}';
    doc.head.append(style);
    doc.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        handlers.current.onFind();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        handlers.current.onEscape();
      }
      if ((event.metaKey || event.ctrlKey) && ['+', '=', '-', '0'].includes(event.key)) {
        event.preventDefault();
        handlers.current.onZoom(event.key === '0' ? 0 : event.key === '-' ? -1 : 1);
      }
    });
    // Pinch and Ctrl+wheel inside the frame zoom the preview, adding deltas up to a preset step.
    const pinch = createPinch();
    doc.addEventListener(
      'wheel',
      (event) => {
        if (!event.ctrlKey) return;
        event.preventDefault();
        const direction = pinch(event);
        if (direction) handlers.current.onZoom(direction, { x: event.clientX, y: event.clientY });
      },
      { passive: false },
    );
    onRoot(doc.body);
    setRevision((current) => current + 1);
  };
  return { frame, loaded };
};
