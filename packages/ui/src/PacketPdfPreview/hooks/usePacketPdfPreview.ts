import { useEffect, useState } from 'react';
import { renderPdf } from '../api.ts';

export function usePacketPdfPreview(bytes: string) {
  const [result, setResult] = useState<{ bytes: string; pages: string[]; error: string }>({
    bytes: '',
    pages: [],
    error: '',
  });
  useEffect(() => {
    const controller = new AbortController();
    void renderPdf(bytes, controller.signal)
      .then((images) => {
        if (!controller.signal.aborted) setResult({ bytes, pages: images, error: '' });
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setResult({
            bytes,
            pages: [],
            error: cause instanceof Error ? cause.message : 'Document preview failed.',
          });
      });
    return () => controller.abort();
  }, [bytes]);
  return result.bytes === bytes
    ? { pages: result.pages, error: result.error }
    : { pages: [], error: '' };
}
