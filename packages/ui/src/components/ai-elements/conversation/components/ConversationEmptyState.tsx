import type { ConversationEmptyStateProps } from '@/components/ai-elements/conversation/types.ts';
import { cn } from '@/lib/utils.ts';

export const ConversationEmptyState = ({
  className,
  title = 'No messages yet',
  description = 'Start a conversation to see messages here',
  icon,
  children,
  ...props
}: ConversationEmptyStateProps) => (
  <div
    className={cn(
      'primitive:flex primitive:size-full primitive:flex-col primitive:items-center primitive:justify-center primitive:gap-3 primitive:p-8 primitive:text-center',
      className,
    )}
    {...props}
  >
    {children ?? (
      <>
        {icon && <div className="primitive:text-muted-foreground">{icon}</div>}
        <div className="primitive:space-y-1">
          <h3 className="primitive:text-sm primitive:font-medium">{title}</h3>
          {description && (
            <p className="primitive:text-sm primitive:text-muted-foreground">{description}</p>
          )}
        </div>
      </>
    )}
  </div>
);
