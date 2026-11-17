import { useEffect, useRef, useState } from 'react';
import { TextLayer, type PDFDocumentProxy } from 'pdfjs-dist';
import { fitScale, pdfToCss, type FitMode } from '../zoom.ts';
export interface PdfPageProps {
  document: PDFDocumentProxy;
  number: number;
  /** Each page fits by its own size, so a landscape page in a portrait file still fits. */
  fit: FitMode;
  room: { width: number; height: number };
  zoom: number;
  /** The first page's scale, used until this page's own size is known. */
  fallback: number;
  rotation: number;
  /** Reports how much of the page is on screen (its visible area), so the most visible is current. */
  onVisible: (page: number, area: number) => void;
  /** Reports the scale this page's fit gives it, so the zoom menu shows the current page's. */
  onBase: (page: number, base: number) => void;
  /** Reports a page that cannot be drawn to the viewer's notice line. */
  onError: (message: string) => void;
}
export const usePdfPage = ({
  document,
  number,
  fit,
  room,
  zoom,
  fallback,
  rotation,
  onVisible,
  onBase,
  onError,
}: PdfPageProps) => {
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void document
      .getPage(number)
      .then((page) => {
        const viewport = page.getViewport({
          scale: pdfToCss,
          rotation: (page.rotate + rotation) % 360,
        });
        if (!cancelled) setNatural({ width: viewport.width, height: viewport.height });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [document, number, rotation]);
  const base = natural ? fitScale(fit, natural, room) : null;
  const scale = base === null ? fallback : (base * zoom) / 100;
  /** pdf.js scale for canvas and text layer: the zoom in CSS pixels per PDF point. */
  const pixels = scale * pdfToCss;
  useEffect(() => {
    if (base !== null) onBase(number, base);
  }, [base, number, onBase]);
  const element = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  // Sized in render from the page's own dimensions, so zoom re-lays out in the same frame and
  // the reading position can be restored against final geometry.
  const size = natural
    ? { width: natural.width * scale, height: natural.height * scale }
    : { width: 612 * pixels, height: 792 * pixels };
  const [error, setError] = useState('');
  useEffect(() => {
    if (error) onError(`Page ${number} couldn’t be drawn. The rest of the file is still readable.`);
  }, [error, number, onError]);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(!!entry?.isIntersecting);
        const shown = entry?.intersectionRect;
        onVisible(number, entry?.isIntersecting && shown ? shown.width * shown.height : 0);
      },
      { threshold: [0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] },
    );
    if (element.current) observer.observe(element.current);
    return () => observer.disconnect();
  }, [number, onVisible]);
  useEffect(() => {
    let cancelled = false;
    let layer: TextLayer | undefined;
    void document
      .getPage(number)
      .then(async (page) => {
        if (cancelled || !text.current) return;
        const viewport = page.getViewport({
          scale: pixels,
          rotation: (page.rotate + rotation) % 360,
        });
        text.current.replaceChildren();
        layer = new TextLayer({
          textContentSource: await page.getTextContent(),
          container: text.current,
          viewport,
        });
        if (cancelled) {
          layer.cancel();
          return;
        }
        await layer.render();
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(String(reason));
      });
    return () => {
      cancelled = true;
      layer?.cancel();
    };
  }, [document, number, pixels, rotation]);
  useEffect(() => {
    if (!visible) return;
    const renderedCanvas = canvas.current;
    let cancelled = false;
    let task: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined;
    void document
      .getPage(number)
      .then(async (page) => {
        if (cancelled || !canvas.current) return;
        const viewport = page.getViewport({
          scale: pixels,
          rotation: (page.rotate + rotation) % 360,
        });
        const ratio = Math.min(
          window.devicePixelRatio || 1,
          2,
          Math.sqrt(8_000_000 / (viewport.width * viewport.height)),
        );
        canvas.current.width = Math.ceil(viewport.width * ratio);
        canvas.current.height = Math.ceil(viewport.height * ratio);
        task = page.render({
          canvas: canvas.current,
          viewport,
          transform: [ratio, 0, 0, ratio, 0, 0],
        });
        await task.promise;
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(String(reason));
      });
    return () => {
      cancelled = true;
      task?.cancel();
      if (renderedCanvas) {
        renderedCanvas.width = 0;
        renderedCanvas.height = 0;
      }
    };
  }, [document, number, pixels, rotation, visible]);
  return { element, canvas, text, size, error, pixels };
};
