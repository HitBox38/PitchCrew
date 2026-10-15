import { Streamdown, type LinkSafetyConfig, type StreamdownProps } from 'streamdown';
import { cn } from '@/lib/utils.ts';
import { LinkConfirmation } from './components/LinkConfirmation.tsx';

const linkSafety: LinkSafetyConfig = {
  enabled: true,
  renderModal: (props) => <LinkConfirmation {...props} />,
};

/** Shared document presentation; chat callers opt into streaming while a turn is active. */
export function MarkdownContent({ className, ...props }: StreamdownProps) {
  return (
    <Streamdown
      mode="static"
      linkSafety={linkSafety}
      className={cn('markdown-content max-w-full min-w-0', className)}
      {...props}
    />
  );
}
