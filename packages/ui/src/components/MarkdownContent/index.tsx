import { Streamdown, type LinkSafetyConfig, type StreamdownProps } from 'streamdown';
import { useMemo } from 'react';
import { cn } from '@/lib/utils.ts';
import { MarkdownCode } from './components/MarkdownCode.tsx';
import { LinkConfirmation } from './components/LinkConfirmation.tsx';

/** Shared document presentation; chat callers opt into streaming while a turn is active. */
export const MarkdownContent = ({ className, components, ...props }: StreamdownProps) => {
  const renderers = useMemo(() => ({ code: MarkdownCode, ...components }), [components]);
  return (
    <Streamdown
      mode="static"
      linkSafety={linkSafety}
      components={renderers}
      className={cn('markdown-content max-w-full min-w-0', className)}
      {...props}
    />
  );
};

const linkSafety: LinkSafetyConfig = {
  enabled: true,
  renderModal: (props) => <LinkConfirmation {...props} />,
};
