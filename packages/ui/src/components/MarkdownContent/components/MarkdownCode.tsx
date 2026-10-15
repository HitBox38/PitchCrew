import type { ComponentProps } from 'react';
import { defaultComponents, type ExtraProps } from 'streamdown';
import { CodeBlock } from '@/components/ui/code-block/components/CodeBlock.tsx';
import { CodeBlockHeader } from '@/components/ui/code-block/components/CodeBlockHeader.tsx';
import { CodeBlockTitle } from '@/components/ui/code-block/components/CodeBlockTitle.tsx';
import { CodeBlockActions } from '@/components/ui/code-block/components/CodeBlockActions.tsx';
import { CodeBlockCopyButton } from '@/components/ui/code-block/components/CodeBlockCopyButton.tsx';
import { CodeBlockContent } from '@/components/ui/code-block/components/CodeBlockContent.tsx';

export function MarkdownCode({
  children,
  className,
  node: _node,
  'data-block': block,
  ...props
}: ComponentProps<'code'> & ExtraProps & { 'data-block'?: string }) {
  if (!block)
    return (
      <defaultComponents.code className={className} {...props}>
        {children}
      </defaultComponents.code>
    );
  const code = typeof children === 'string' ? children : '';
  const language = /language-([^\s]+)/.exec(className ?? '')?.[1];
  return (
    <CodeBlock data-streamdown="code-block" data-language={language}>
      <CodeBlockHeader>
        <CodeBlockTitle>{language ?? 'Code'}</CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton value={code} />
        </CodeBlockActions>
      </CodeBlockHeader>
      <CodeBlockContent className="max-h-96">{code}</CodeBlockContent>
    </CodeBlock>
  );
}
