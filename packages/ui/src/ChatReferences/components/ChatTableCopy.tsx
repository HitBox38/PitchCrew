import { useEffect, useState, type RefObject } from 'react';
import { Check, Copy } from 'lucide-react';
import { extractTableDataFromElement, tableDataToMarkdown } from 'streamdown';
import { Button } from '@pitchcrew/design-system/button';

export const ChatTableCopy = ({
  table,
  disabled,
}: {
  table: RefObject<HTMLTableElement | null>;
  disabled: boolean;
}) => {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  useEffect(() => {
    if (status !== 'copied') return;
    const timer = setTimeout(() => setStatus('idle'), 2000);
    return () => clearTimeout(timer);
  }, [status]);
  const copy = async () => {
    if (!table.current) return;
    try {
      await navigator.clipboard.writeText(
        tableDataToMarkdown(extractTableDataFromElement(table.current)),
      );
      setStatus('copied');
    } catch {
      setStatus('error');
    }
  };
  const Icon = status === 'copied' ? Check : Copy;
  return (
    <>
      <output
        className="chat-table-copy-status"
        data-error={status === 'error' || undefined}
        aria-live="polite"
      >
        {status === 'error'
          ? 'Couldn’t copy. Select the table text to copy it.'
          : status === 'copied'
            ? 'Table copied'
            : null}
      </output>
      <Button
        variant="ghost"
        size="sm"
        className="chat-table-copy"
        aria-label="Copy table as Markdown"
        onClick={copy}
        disabled={disabled}
      >
        <Icon size={13} aria-hidden="true" /> {status === 'copied' ? 'Copied' : 'Copy'}
      </Button>
    </>
  );
};
