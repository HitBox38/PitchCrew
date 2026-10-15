import * as React from 'react';
import { cn } from '@/lib/utils.ts';
import { CodeBlockLine } from './CodeBlockLine.tsx';

export function CodeBlockContent({
  className,
  children,
  style,
  wrap = false,
  lineNumbers = false,
  startLine = 1,
  ...props
}: React.ComponentProps<'pre'> & {
  wrap?: boolean;
  lineNumbers?: boolean;
  startLine?: number;
}) {
  return (
    <pre
      data-slot="code-block-content"
      data-wrap={wrap || undefined}
      data-numbered={lineNumbers || undefined}
      dir="ltr"
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users must be able to scroll code.
      tabIndex={0}
      style={{ counterReset: `line ${startLine - 1}`, ...style }}
      className={cn(
        'primitive:scroll-fade-x primitive:data-wrap:scroll-fade-y primitive:min-h-0 primitive:min-w-0 primitive:scrollbar-thin primitive:overflow-auto primitive:px-4 primitive:py-4 primitive:text-start primitive:font-mono primitive:leading-relaxed primitive:outline-none primitive:group-has-data-[slot=code-block-footer]/code-block:pb-2 primitive:group-has-data-[slot=code-block-header]/code-block:pt-2 primitive:group-data-[size=sm]/code-block:px-3 primitive:group-data-[size=sm]/code-block:py-3 primitive:group-data-[size=sm]/code-block:group-has-data-[slot=code-block-header]/code-block:pt-1.5 primitive:data-wrap:wrap-break-word primitive:data-wrap:whitespace-pre-wrap',
        className,
      )}
      {...props}
    >
      <code
        data-slot="code-block-code"
        className="primitive:grid primitive:min-h-lh primitive:min-w-max primitive:content-start primitive:in-data-numbered:grid-cols-[auto_1fr] primitive:in-data-wrap:min-w-0"
      >
        {lineNumbers && typeof children === 'string'
          ? children
              .replace(/\n$/, '')
              .split('\n')
              .map((line, index) => <CodeBlockLine key={index}>{line}</CodeBlockLine>)
          : children}
      </code>
    </pre>
  );
}
