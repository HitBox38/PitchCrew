import { lazy, Suspense, useContext, useEffect, useRef, useState } from 'react';
import { FileText, LoaderCircle } from 'lucide-react';
import { ReferenceContext } from '../context.ts';
import { citationFile } from '../file-citations.ts';
import { loadCitationAttachment } from '../api.ts';
import { parseFileCitation } from '@pitchcrew/core/chat-citations';
import type { ViewerFile } from '@/FileViewer/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
  PopoverDescription,
} from '@/components/ui/popover/index.tsx';
const FileViewer = lazy(() =>
  import('@/FileViewer/index.tsx').then((module) => ({ default: module.FileViewer })),
);

export const FileCitation = ({ url, label }: { url: string; label: string }) => {
  const { catalog } = useContext(ReferenceContext);
  const [file, setFile] = useState<ViewerFile>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const target = citationFile(url, catalog);
  const unavailable = parseFileCitation(url)?.kind !== 'attachment' && !target;
  const open = async () => {
    if (pending.current) return;
    setError('');
    if (target) {
      setFile(target);
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    try {
      const loaded = await loadCitationAttachment(url, controller.signal);
      if (!controller.signal.aborted) setFile(loaded);
    } catch (reason) {
      if (!controller.signal.aborted)
        setError(reason instanceof Error ? reason.message : 'Could not open file.');
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  };
  return (
    <>
      <Popover
        open={unavailable ? undefined : !!error}
        onOpenChange={(open) => {
          if (!open) setError('');
        }}
      >
        <PopoverTrigger
          render={<Button variant="ghost" className="chat-reference chat-reference-file" />}
          aria-label={`File: ${label}${unavailable ? ', unavailable' : ''}`}
          data-reference-token={`[${label}](${url})`}
          data-unavailable={unavailable || undefined}
          onClick={() => {
            if (!unavailable) void open();
          }}
          disabled={loading}
        >
          {loading ? (
            <LoaderCircle size={13} aria-hidden="true" className="motion-safe:animate-spin" />
          ) : (
            <FileText size={13} aria-hidden="true" />
          )}
          <span>{label}</span>
        </PopoverTrigger>
        <PopoverContent className="chat-reference-details">
          <PopoverTitle>{label}</PopoverTitle>
          <PopoverDescription>
            {error ||
              (unavailable
                ? 'This referenced file is no longer available.'
                : 'Opening read-only file preview…')}
          </PopoverDescription>
        </PopoverContent>
      </Popover>
      {file ? (
        <Suspense fallback={<output>Opening file preview…</output>}>
          <FileViewer files={[file]} initialIndex={0} close={() => setFile(undefined)} />
        </Suspense>
      ) : null}
    </>
  );
};
