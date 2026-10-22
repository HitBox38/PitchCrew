import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { Button } from '@/components/ui/button/components/Button.tsx';
export const PdfThumbnail = ({
  document,
  pageNumber,
  select,
}: {
  document: PDFDocumentProxy;
  pageNumber: number;
  select: () => void;
}) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    let cancelled = false;
    let task: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      void document
        .getPage(pageNumber)
        .then(async (page) => {
          if (cancelled) return;
          const viewport = page.getViewport({ scale: 0.16 });
          target.width = Math.ceil(viewport.width);
          target.height = Math.ceil(viewport.height);
          task = page.render({ canvas: target, viewport });
          await task.promise;
        })
        .catch(() => {
          if (!cancelled) setError(true);
        });
    });
    observer.observe(target);
    return () => {
      cancelled = true;
      observer.disconnect();
      task?.cancel();
    };
  }, [document, pageNumber]);
  return (
    <Button
      className="pdf-thumbnail"
      variant="outline"
      onClick={select}
      aria-label={`Go to page ${pageNumber}`}
    >
      <canvas ref={canvas} aria-hidden="true" />
      <span>
        {error ? 'Preview unavailable · ' : ''}Page {pageNumber}
      </span>
    </Button>
  );
};
