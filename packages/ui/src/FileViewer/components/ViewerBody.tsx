import { noRemoteImages } from '@/components/ai-elements/message/constants.tsx';
import { ImageDocument } from './ImageDocument.tsx';
import { lazy, Suspense } from 'react';
import { MarkdownContent } from '@/components/MarkdownContent/index.tsx';
import type { FileViewerModel } from '../hooks/useFileViewer.ts';
const PdfDocument = lazy(() => import('./PdfDocument.tsx'));
const DocxDocument = lazy(() => import('./DocxDocument.tsx'));
export const ViewerBody = ({
  model: { file, settings, attachBody, onInfo, onPage, setRoot, openFind, closeFromFrame },
}: {
  model: FileViewerModel;
}) => {
  return (
    <div className="file-view-body" ref={attachBody}>
      <Suspense fallback={<output className="p-6">Loading document viewer…</output>}>
        {file.kind === 'pdf' ? (
          <div ref={setRoot}>
            <PdfDocument bytes={file.bytes!} settings={settings} onInfo={onInfo} onPage={onPage} />
          </div>
        ) : file.kind === 'docx' && settings.mode === 'rendered' ? (
          <DocxDocument
            bytes={file.bytes!}
            name={file.name}
            settings={settings}
            onRoot={setRoot}
            onFind={openFind}
            onEscape={closeFromFrame}
          />
        ) : file.kind === 'image' ? (
          <ImageDocument file={file} settings={settings} />
        ) : (
          <div
            ref={setRoot}
            className="file-text-document"
            style={{ fontSize: `${settings.zoom}%` }}
          >
            {file.kind === 'markdown' && settings.mode === 'rendered' ? (
              <MarkdownContent components={noRemoteImages}>{file.text ?? ''}</MarkdownContent>
            ) : (
              <pre style={{ whiteSpace: settings.wrap ? 'pre-wrap' : 'pre' }}>
                {file.text ?? ''}
              </pre>
            )}
          </div>
        )}
      </Suspense>
    </div>
  );
};
