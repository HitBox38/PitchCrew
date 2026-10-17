import { CodeBlock } from '@/components/ui/code-block/components/CodeBlock.tsx';
import { CodeBlockHeader } from '@/components/ui/code-block/components/CodeBlockHeader.tsx';
import { CodeBlockTitle } from '@/components/ui/code-block/components/CodeBlockTitle.tsx';
import { CodeBlockActions } from '@/components/ui/code-block/components/CodeBlockActions.tsx';
import { CodeBlockCopyButton } from '@/components/ui/code-block/components/CodeBlockCopyButton.tsx';
import { CodeBlockContent } from '@/components/ui/code-block/components/CodeBlockContent.tsx';
import { cn } from '@/lib/utils.ts';

/** Exact source text for review and copying; content is never parsed as markup. */
export function SourceBlock({
  value,
  label,
  className,
  contentClassName,
  wrap = true,
}: {
  value: string;
  label: string;
  className?: string;
  contentClassName?: string;
  wrap?: boolean;
}) {
  return (
    <CodeBlock size="sm" className={cn('my-3', className)}>
      <CodeBlockHeader>
        <CodeBlockTitle>{label}</CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton value={value} aria-label={`Copy ${label}`} />
        </CodeBlockActions>
      </CodeBlockHeader>
      <CodeBlockContent aria-label={label} wrap={wrap} className={cn('max-h-80', contentClassName)}>
        {value}
      </CodeBlockContent>
    </CodeBlock>
  );
}
