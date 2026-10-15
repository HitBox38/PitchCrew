import type { PromptInputProps } from '@/components/ai-elements/prompt-input/types.ts';
import { InputGroup } from '@/components/ui/input-group/components/InputGroup.tsx';
import { cn } from '@/lib/utils.ts';

export const PromptInput = ({ className, onSubmit, children, ...props }: PromptInputProps) => (
  <form
    className={cn('primitive:w-full', className)}
    onSubmit={async (event) => {
      event.preventDefault();
      const text = String(new FormData(event.currentTarget).get('message') ?? '');
      // Controlled text is cleared by the caller after success, retained on failure.
      try {
        await onSubmit({ text, files: [] }, event);
      } catch {
        // The caller presents its request error and retains the controlled draft.
      }
    }}
    {...props}
  >
    <InputGroup className="primitive:overflow-hidden">{children}</InputGroup>
  </form>
);
