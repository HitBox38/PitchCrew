import { useEffect, useState, useRef, useCallback } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { localPdfTask } from '@/PacketPdfPreview/api.ts';
import type { ViewerSettings } from '../types.ts';
export interface PdfDocumentProps {
  bytes: string;
  settings: ViewerSettings;
  onInfo: (pages: number, hasText?: boolean) => void;
  onPage: (page: number) => void;
}
export const usePdfDocument = ({ bytes, settings, onInfo, onPage }: PdfDocumentProps) => {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState('');
  const [width, setWidth] = useState(700);
  const [height, setHeight] = useState(550);
  const [naturalSize, setNaturalSize] = useState({ width: 612, height: 792 });
  const [searchable, setSearchable] = useState<boolean | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const lastRequested = useRef(settings.page);
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
          const viewport = first.getViewport({ scale: 1 });
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
            setSearchable(hasText);
            onInfo(pdf.numPages, hasText);
          }
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(String(reason));
      });
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [bytes, onInfo]);
  useEffect(() => {
    const resize = new ResizeObserver(([entry]) => {
      if (entry) setWidth(container.current?.clientWidth ?? entry.contentRect.width);
      setHeight(container.current?.closest('.file-view-body')?.clientHeight ?? 550);
    });
    if (container.current) {
      resize.observe(container.current);
      const body = container.current.closest('.file-view-body');
      if (body) resize.observe(body);
    }
    return () => resize.disconnect();
  }, []);
  useEffect(() => {
    if (settings.page !== lastRequested.current)
      container.current
        ?.querySelector(`[data-page="${settings.page}"]`)
        ?.scrollIntoView({ block: 'start' });
    lastRequested.current = settings.page;
  }, [settings.page]);
  const visible = useCallback(
    (page: number) => {
      onPage(page);
    },
    [onPage],
  );
  return { document, error, width, height, naturalSize, searchable, container, visible };
};
