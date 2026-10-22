import { useDocxFrame } from '../hooks/useDocxFrame.ts';
import { useEffect, useState } from 'react';
import { renderDocx } from '@/PacketDocxPreview/api.ts';
import type { ViewerSettings } from '../types.ts';
const DocxDocument = ({
  bytes,
  name,
  settings,
  onRoot,
  onFind,
  onEscape,
}: {
  bytes: string;
  name: string;
  settings: ViewerSettings;
  onRoot: (root: HTMLElement | null) => void;
  onFind: () => void;
  onEscape: () => void;
}) => {
  const { frame, loaded } = useDocxFrame(settings, onRoot, onFind, onEscape);
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void renderDocx(bytes, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setHtml(result);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(String(reason));
      });
    return () => {
      controller.abort();
      onRoot(null);
    };
  }, [bytes, onRoot]);
  return (
    <div className="file-docx-document">
      <p className="file-view-note">
        DOCX layout may differ from Word. Page estimates are not final Word pagination.
      </p>
      {error ? (
        <p role="alert">DOCX preview: {error}</p>
      ) : !html ? (
        <output>Rendering DOCX…</output>
      ) : (
        <iframe
          title={`${name} DOCX preview`}
          srcDoc={html}
          sandbox="allow-same-origin"
          referrerPolicy="no-referrer"
          onLoad={loaded}
          ref={frame}
        />
      )}
    </div>
  );
};
export default DocxDocument;
