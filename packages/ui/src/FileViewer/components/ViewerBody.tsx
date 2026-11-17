import { noRemoteImages } from '@/components/ai-elements/message/constants.tsx';
import { ImageDocument } from './ImageDocument.tsx';
import { lazy, Suspense } from 'react';
import { MarkdownContent } from '@/components/MarkdownContent/index.tsx';
import type { FileViewerModel } from '../hooks/useFileViewer.ts';
const PdfDocument = lazy(() => import('./PdfDocument.tsx'));
const DocxDocument = lazy(() => import('./DocxDocument.tsx'));

/** The scrolling document: PDF and Word pages on the tray, or one reading pane for text. */
export const ViewerBody = ({
  model: {
    file,
    settings,
    attachBody,
    onInfo,
    onPage,
    setRoot,
    openFind,
    closeFromFrame,
    zoom,
    visiblePage,
    onImageReady,
    reportError,
    zoomAt,
  },
}: {
  model: FileViewerModel;
}) => (
  // The document is the dialog's first stop, so arrow keys, Page Down and Space scroll it.
  <section
    className="file-view-body"
    ref={attachBody}
    aria-label={`${file.name} contents`}
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard readers scroll the document.
    tabIndex={0}
  >
    <Suspense fallback={<output className="file-view-loading">Loading document viewer…</output>}>
      {file.kind === 'pdf' ? (
        <div ref={setRoot} className="file-pdf-root">
          <PdfDocument
            bytes={file.bytes!}
            settings={settings}
            onInfo={onInfo}
            onPage={onPage}
            onScale={zoom.onScale}
            current={visiblePage}
            onError={reportError}
          />
        </div>
      ) : file.kind === 'docx' && settings.mode === 'rendered' ? (
        <DocxDocument
          bytes={file.bytes!}
          name={file.name}
          settings={settings}
          onRoot={setRoot}
          onFind={openFind}
          onEscape={closeFromFrame}
          onScale={zoom.onScale}
          onZoom={(direction, point) => (direction ? zoomAt(direction, point) : zoom.resetZoom())}
          onError={reportError}
        />
      ) : file.kind === 'image' ? (
        <ImageDocument
          file={file}
          settings={settings}
          onScale={zoom.onScale}
          onReady={onImageReady}
          onError={reportError}
        />
      ) : (
        <article
          ref={setRoot}
          className="file-text-document"
          data-mode={
            file.kind === 'markdown' && settings.mode === 'rendered' ? 'rendered' : 'source'
          }
          // 100% is a 16px reading size, whatever the app's interface text size.
          style={{ fontSize: `${settings.zoom / 100}rem` }}
        >
          {file.kind === 'markdown' && settings.mode === 'rendered' ? (
            // Streamdown's table controls would download content the packet gate still locks.
            <MarkdownContent components={noRemoteImages} controls={false}>
              {file.text ?? ''}
            </MarkdownContent>
          ) : (
            <pre style={{ whiteSpace: settings.wrap ? 'pre-wrap' : 'pre' }}>{file.text ?? ''}</pre>
          )}
        </article>
      )}
    </Suspense>
  </section>
);
