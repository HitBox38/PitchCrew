import type { ComponentProps } from 'react';
import { defaultComponents, type ExtraProps } from 'streamdown';
import {
  CodeBlock,
  CodeBlockHeader,
  CodeBlockTitle,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockContent,
} from '@pitchcrew/design-system/code-block';

export const MarkdownCode = ({
  children,
  className,
  node: _node,
  'data-block': block,
  ...props
}: ComponentProps<'code'> & ExtraProps & { 'data-block'?: string }) => {
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
};
