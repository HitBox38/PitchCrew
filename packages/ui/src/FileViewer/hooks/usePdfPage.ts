import { useEffect, useRef, useState } from 'react';
import { TextLayer, type PDFDocumentProxy } from 'pdfjs-dist';
export interface PdfPageProps {
  document: PDFDocumentProxy;
  number: number;
  scale: number;
  rotation: number;
  onVisible: (page: number) => void;
}
export const usePdfPage = ({ document, number, scale, rotation, onVisible }: PdfPageProps) => {
  const element = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [size, setSize] = useState({ width: 612 * scale, height: 792 * scale });
  const [error, setError] = useState('');
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(!!entry?.isIntersecting);
        if (entry?.isIntersecting) onVisible(number);
      },
      { threshold: 0.05 },
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
        const viewport = page.getViewport({ scale, rotation: (page.rotate + rotation) % 360 });
        setSize({ width: viewport.width, height: viewport.height });
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
  }, [document, number, scale, rotation]);
  useEffect(() => {
    if (!visible) return;
    const renderedCanvas = canvas.current;
    let cancelled = false;
    let task: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined;
    void document
      .getPage(number)
      .then(async (page) => {
        if (cancelled || !canvas.current) return;
        const viewport = page.getViewport({ scale, rotation: (page.rotate + rotation) % 360 });
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
  }, [document, number, scale, rotation, visible]);
  return { element, canvas, text, size, error };
};
