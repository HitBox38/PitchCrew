import { useCallback, useEffect, useState } from 'react';
import { usePdfDocument, type PdfDocumentProps } from '../hooks/usePdfDocument.ts';
import { PdfPage } from './PdfPage.tsx';
import { PdfSidebar } from './PdfSidebar.tsx';
import { fitScale } from '../zoom.ts';
import 'pdfjs-dist/web/pdf_viewer.css';
import { useMediaQuery } from '@/hooks/useMediaQuery.ts';
/** The thumbnail column's width, including its divider. */
const thumbnailColumn = 133;
const PdfDocument = (props: PdfDocumentProps) => {
  const { settings, onScale } = props;
  const { document, error, width, height, gutter, naturalSize, container, visible } =
    usePdfDocument(props);
  // Phones have no room beside the page, so thumbnails stay off there.
  const phone = useMediaQuery('(width < 48rem)');
  const thumbnails = settings.thumbnails && !phone;
  const sideways = settings.rotation % 180 !== 0;
  const page = sideways ? { width: naturalSize.height, height: naturalSize.width } : naturalSize;
  const room = {
    width: Math.max(100, width - gutter.x * 2 - (thumbnails ? thumbnailColumn : 0)),
    height: Math.max(100, height - gutter.top - gutter.bottom),
  };
  const fit = fitScale(settings.fit, page, room);
  // Pages fit by their own size; the zoom menu shows the scale of the page most on screen.
  const [bases, setBases] = useState<Record<number, number>>({});
  const onBase = useCallback(
    (number: number, base: number) =>
      setBases((current) => (current[number] === base ? current : { ...current, [number]: base })),
    [],
  );
  const shownBase = bases[props.current] ?? fit;
  useEffect(() => onScale(shownBase), [shownBase, onScale]);
  return (
    <div ref={container} className="file-pdf-document">
      {error ? (
        <p className="file-view-loading">PDF preview unavailable.</p>
      ) : !document ? (
        <output className="file-view-loading">Loading PDF…</output>
      ) : (
        <>
          {thumbnails ? (
            <PdfSidebar
              document={document}
              height={height}
              current={props.current}
              jump={(number) =>
                container.current
                  ?.querySelector(`[data-page="${number}"]`)
                  ?.scrollIntoView({ block: 'start' })
              }
            />
          ) : null}
          <div className="file-pdf-pages">
            {Array.from({ length: document.numPages }, (_, index) => (
              <PdfPage
                key={index + 1}
                document={document}
                number={index + 1}
                fit={settings.fit}
                room={room}
                zoom={settings.zoom}
                fallback={(fit * settings.zoom) / 100}
                rotation={settings.rotation}
                onVisible={visible}
                onBase={onBase}
                onError={props.onError}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
export default PdfDocument;
