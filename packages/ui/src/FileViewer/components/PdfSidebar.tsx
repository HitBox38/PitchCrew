import { useEffect, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { PdfThumbnail } from './PdfThumbnail.tsx';
export const PdfSidebar = ({
  document,
  jump,
}: {
  document: PDFDocumentProxy;
  jump: (page: number) => void;
}) => {
  const [outline, setOutline] = useState<{ title: string; dest: unknown }[]>([]);
  useEffect(() => {
    let cancelled = false;
    void document
      .getOutline()
      .then((items) => {
        if (!cancelled) setOutline((items ?? []).flatMap((item) => [item, ...(item.items ?? [])]));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [document]);
  const follow = async (dest: unknown) => {
    const destination = typeof dest === 'string' ? await document.getDestination(dest) : dest;
    if (!Array.isArray(destination)) return;
    const first = destination[0];
    const index = typeof first === 'number' ? first : await document.getPageIndex(first);
    jump(index + 1);
  };
  return (
    <nav className="file-page-sidebar" aria-label="PDF pages">
      {outline.length ? (
        <div className="pdf-outline">
          <h3>Document outline</h3>
          {outline.map((item, index) => (
            <Button
              key={`${index}:${item.title}`}
              size="sm"
              variant="ghost"
              onClick={() => void follow(item.dest).catch(() => {})}
            >
              {item.title}
            </Button>
          ))}
        </div>
      ) : null}
      {Array.from({ length: document.numPages }, (_, index) => (
        <PdfThumbnail
          key={index + 1}
          document={document}
          pageNumber={index + 1}
          select={() => jump(index + 1)}
        />
      ))}
    </nav>
  );
};
