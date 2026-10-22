import { useEffect, useRef, useState } from 'react';
import type { ViewerSettings } from '../types.ts';
export const useDocxFrame = (
  settings: ViewerSettings,
  onRoot: (root: HTMLElement | null) => void,
  onFind: () => void,
  onEscape: () => void,
) => {
  const [revision, setRevision] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  const handlers = useRef({ onFind, onEscape });
  useEffect(() => {
    handlers.current = { onFind, onEscape };
  }, [onFind, onEscape]);
  useEffect(() => {
    const target = frame.current;
    if (!target) return;
    const resize = () => {
      const doc = target.contentDocument;
      const page = doc?.querySelector<HTMLElement>('section.docx');
      if (!doc || !page) return;
      const fit =
        settings.fit === 'width' ? Math.max(0.1, (target.clientWidth - 24) / page.offsetWidth) : 1;
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
  }, [settings.zoom, settings.fit, revision]);
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
    });
    onRoot(doc.body);
    setRevision((current) => current + 1);
  };
  return { frame, loaded };
};
