import * as React from 'react';
import { cn } from '../../../lib/utils.ts';
import { Button } from '../../button/components/Button.tsx';
import { CheckIcon, CopyIcon } from 'lucide-react';

export const CodeBlockCopyButton = ({
  value,
  label,
  variant = 'ghost',
  size = 'icon-xs',
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button> & { value: string; label?: string }) => {
  const [copied, setCopied] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  return (
    <>
      <Button
        data-slot="code-block-copy-button"
        data-copied={copied || undefined}
        variant={variant}
        size={size}
        aria-label={copied ? 'Copied' : 'Copy'}
        className={cn(className)}
        onClick={async (event) => {
          onClick?.(event);
          if (event.defaultPrevented) return;
          setFailed(false);
          setCopied(false);
          try {
            if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
            await navigator.clipboard.writeText(value);
            setCopied(true);
          } catch {
            setFailed(true);
          }
        }}
        {...props}
      >
        <span data-slot="icon-swap" data-swapped={copied || undefined} aria-hidden="true">
          <CopyIcon />
          <CheckIcon />
        </span>
        {label ? <span>{label}</span> : null}
      </Button>
      <span aria-live="polite" className={failed ? 'primitive:text-xs' : 'primitive:sr-only'}>
        {failed ? 'Could not copy. Select the text and copy it manually.' : copied ? 'Copied' : ''}
      </span>
    </>
  );
};
