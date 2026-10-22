import { usePdfDocument, type PdfDocumentProps } from '../hooks/usePdfDocument.ts';
import { PdfPage } from './PdfPage.tsx';
import { PdfSidebar } from './PdfSidebar.tsx';
import 'pdfjs-dist/web/pdf_viewer.css';
const PdfDocument = (props: PdfDocumentProps) => {
  const { settings } = props;
  const { document, error, width, height, naturalSize, searchable, container, visible } =
    usePdfDocument(props);
  const available = Math.max(100, width - (settings.thumbnails ? 150 : 0) - 40);
  const base = settings.rotation % 180 ? naturalSize.height : naturalSize.width;
  const fit =
    settings.fit === 'width'
      ? Math.max(0.2, available / base)
      : settings.fit === 'page'
        ? Math.max(
            0.1,
            Math.min(
              available / base,
              (height - 48) / (settings.rotation % 180 ? naturalSize.width : naturalSize.height),
            ),
          )
        : 1;
  return (
    <div ref={container} className="file-pdf-document">
      {error ? (
        <p role="alert">PDF preview: {error}</p>
      ) : !document ? (
        <output>Loading PDF…</output>
      ) : (
        <>
          {settings.thumbnails ? (
            <PdfSidebar
              document={document}
              jump={(page) =>
                container.current
                  ?.querySelector(`[data-page="${page}"]`)
                  ?.scrollIntoView({ block: 'start' })
              }
            />
          ) : null}
          <div className="file-pdf-pages">
            {searchable === false ? (
              <output className="file-view-note">
                This PDF has no extractable text. Search and text selection are unavailable; no OCR
                has been performed.
              </output>
            ) : null}
            {Array.from({ length: document.numPages }, (_, index) => (
              <PdfPage
                key={index + 1}
                document={document}
                number={index + 1}
                scale={(fit * settings.zoom) / 100}
                rotation={settings.rotation}
                onVisible={visible}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
export default PdfDocument;
