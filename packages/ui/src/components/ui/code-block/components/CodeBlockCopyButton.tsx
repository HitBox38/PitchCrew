import * as React from 'react';
import { cn } from '@/lib/utils.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { CheckIcon, CopyIcon } from 'lucide-react';

export function CodeBlockCopyButton({
  value,
  variant = 'ghost',
  size = 'icon-xs',
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button> & { value: string }) {
  const [copied, setCopied] = React.useState(false);

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
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented) return;
          navigator.clipboard
            ?.writeText(value)
            .then(() => setCopied(true))
            .catch(() => {});
        }}
        {...props}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
      <span aria-live="polite" className="primitive:sr-only">
        {copied ? 'Copied' : ''}
      </span>
    </>
  );
}
