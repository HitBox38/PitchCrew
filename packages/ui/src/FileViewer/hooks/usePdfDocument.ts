import { useEffect, useState, useRef, useCallback } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { localPdfTask } from '../pdf-task.ts';
import { readGutters } from '../gutters.ts';
import { pdfToCss } from '../zoom.ts';
import type { ViewerSettings } from '../types.ts';
export interface PdfDocumentProps {
  bytes: string;
  settings: ViewerSettings;
  onInfo: (pages: number, hasText?: boolean) => void;
  onPage: (page: number) => void;
  /** Receives the base scale the fit mode gives, so the zoom menu can show the real percentage. */
  onScale: (scale: number) => void;
  /** The page most on screen, marked in the thumbnails. */
  current: number;
  /** Reports a PDF that cannot be opened to the viewer's notice line. */
  onError: (message: string) => void;
}
export const usePdfDocument = ({ bytes, settings, onInfo, onPage, onError }: PdfDocumentProps) => {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState('');
  const [width, setWidth] = useState(700);
  const [height, setHeight] = useState(550);
  const [naturalSize, setNaturalSize] = useState({ width: 816, height: 1056 });
  const container = useRef<HTMLDivElement>(null);
  const lastRequested = useRef(settings.pageRequest);
  useEffect(() => {
    let cancelled = false;
    let task: Awaited<ReturnType<typeof localPdfTask>> | undefined;
    void localPdfTask(bytes)
      .then(async (loading) => {
        task = loading;
        if (cancelled) {
          await task.destroy();
          return;
        }
        const pdf = await task.promise;
        if (!cancelled) {
          setDocument(pdf);
          onInfo(pdf.numPages);
          const first = await pdf.getPage(1);
          const viewport = first.getViewport({ scale: pdfToCss });
          if (cancelled) return;
          setNaturalSize({ width: viewport.width, height: viewport.height });
          let hasText = false;
          for (let number = 1; number <= pdf.numPages && !cancelled; number++) {
            const page = await pdf.getPage(number);
            const content = await page.getTextContent();
            if (content.items.some((item) => 'str' in item && item.str.trim())) {
              hasText = true;
              break;
            }
          }
          if (!cancelled) {
            onInfo(pdf.numPages, hasText);
          }
        }
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(String(reason));
        onError('This PDF couldn’t be opened. The file may be damaged.');
      });
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [bytes, onInfo, onError]);
  const [gutter, setGutter] = useState({ top: 56, x: 32, bottom: 32 });
  // Fit from the bounded reading area and its CSS gutters, never from the pages' own width.
  useEffect(() => {
    const body = container.current?.closest<HTMLElement>('.file-view-body');
    if (!body) return;
    const measure = () => {
      setWidth(body.clientWidth);
      setHeight(body.clientHeight);
      setGutter((current) => {
        const next = readGutters(body);
        return next.top === current.top && next.x === current.x && next.bottom === current.bottom
          ? current
          : next;
      });
    };
    const resize = new ResizeObserver(measure);
    resize.observe(body);
    return () => resize.disconnect();
  }, [document]);
  useEffect(() => {
    if (settings.pageRequest !== lastRequested.current)
      container.current
        ?.querySelector(`[data-page="${settings.page}"]`)
        ?.scrollIntoView({ block: 'start' });
    lastRequested.current = settings.pageRequest;
  }, [settings.page, settings.pageRequest]);
  const areas = useRef(new Map<number, number>());
  /** The current page is the one with the most of it on screen. */
  const visible = useCallback(
    (page: number, area: number) => {
      areas.current.set(page, area);
      let current = page;
      for (const [number, shown] of areas.current)
        if (shown > (areas.current.get(current) ?? 0)) current = number;
      onPage(current);
    },
    [onPage],
  );
  return { document, error, width, height, gutter, naturalSize, container, visible };
};
