import {
  CodeBlock,
  CodeBlockHeader,
  CodeBlockTitle,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockContent,
} from '@pitchcrew/design-system/code-block';
import { cn } from '@pitchcrew/design-system/utils';

/** Exact source text for review and copying; content is never parsed as markup. */
export const SourceBlock = ({
  value,
  label,
  className,
  contentClassName,
  copyLabel,
  wrap = true,
}: {
  value: string;
  label: string;
  className?: string;
  contentClassName?: string;
  copyLabel?: string;
  wrap?: boolean;
}) => {
  return (
    <CodeBlock size="sm" className={cn('my-3', className)}>
      <CodeBlockHeader>
        <CodeBlockTitle>{label}</CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton
            key={value}
            value={value}
            label={copyLabel}
            size={copyLabel ? 'sm' : undefined}
            aria-label={copyLabel ?? `Copy ${label}`}
          />
        </CodeBlockActions>
      </CodeBlockHeader>
      <CodeBlockContent aria-label={label} wrap={wrap} className={cn('max-h-80', contentClassName)}>
        {value}
      </CodeBlockContent>
    </CodeBlock>
  );
};
