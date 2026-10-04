import { useEffect, useState } from 'react';
import { renderDocx } from '../api.ts';

export function usePacketDocxPreview(bytes: string) {
  const [result, setResult] = useState({ bytes: '', document: '', error: '' });
  useEffect(() => {
    const controller = new AbortController();
    void renderDocx(bytes, controller.signal)
      .then((document) => {
        if (!controller.signal.aborted) setResult({ bytes, document, error: '' });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResult({
            bytes,
            document: '',
            error:
              'Could not render this file. You can still review the complete document text below.',
          });
      });
    return () => controller.abort();
  }, [bytes]);
  return result.bytes === bytes ? result : { document: '', error: '' };
}
