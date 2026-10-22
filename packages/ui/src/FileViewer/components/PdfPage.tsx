import type { CSSProperties } from 'react';
import { usePdfPage, type PdfPageProps } from '../hooks/usePdfPage.ts';
export const PdfPage = (props: PdfPageProps) => {
  const { element, canvas, text, size, error } = usePdfPage(props);
  const { number, scale } = props;
  return (
    <div
      ref={element}
      className="file-pdf-page"
      data-page={number}
      style={{ ...size, '--total-scale-factor': scale } as CSSProperties}
      aria-label={`Page ${number}`}
    >
      <canvas ref={canvas} aria-hidden="true" />
      <div className="textLayer" ref={text} />
      {error ? (
        <p role="alert">
          Could not render page {number}: {error}
        </p>
      ) : null}
    </div>
  );
};
