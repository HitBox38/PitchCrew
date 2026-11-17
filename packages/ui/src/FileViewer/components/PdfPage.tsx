import type { CSSProperties } from 'react';
import { usePdfPage, type PdfPageProps } from '../hooks/usePdfPage.ts';
export const PdfPage = (props: PdfPageProps) => {
  const { element, canvas, text, size, error, pixels } = usePdfPage(props);
  const { number } = props;
  return (
    <div
      ref={element}
      className="file-pdf-page"
      data-page={number}
      style={{ ...size, '--total-scale-factor': pixels } as CSSProperties}
      aria-label={`Page ${number}`}
    >
      <canvas ref={canvas} aria-hidden="true" />
      <div className="textLayer" ref={text} />
      {error ? <p className="file-page-error">Page {number} could not be shown.</p> : null}
    </div>
  );
};
