import { BrowserModePicker } from '@/AgentBrowser/components/BrowserModePicker.tsx';
import { Button } from '@pitchcrew/design-system/button';
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@pitchcrew/design-system/popover';
import { Globe } from 'lucide-react';
import type { ChatComposerProps } from '../types.ts';
import { memo } from 'react';
import { deepEqual } from '@/lib/share-equal.ts';

type ComposerOptionsProps = Pick<ChatComposerProps, 'role' | 'conversation' | 'working'> & {
  /** The role as the browser panel knows it (its saved browser mode). */
  panelRole?: ChatComposerProps['role'];
  /** Stable (see ComposerFooter), so the options do not render again on every update. */
  patchConversation: ChatComposerProps['patchConversation'];
};

/** Keep preparation permissions reachable when the chat lane cannot fit another picker. */
export const ComposerOptions = memo((props: ComposerOptionsProps) => {
  if (!props.role.capabilities?.computerUse) return null;
  const role = props.panelRole ?? props.role;
  const override = props.conversation?.configurations[role.id]?.browserMode;
  const autonomous = (override ?? role.browserMode) === 'autonomous';
  const mode = autonomous ? 'Autonomous preparation' : 'Supervised';
  const picker = (
    <BrowserModePicker
      role={role}
      conversation={props.conversation}
      disabled={props.working}
      save={(patch) => void props.patchConversation(patch)}
    />
  );
  return (
    <>
      <div className="chat-composer-browser-options">{picker}</div>
      <div className="chat-composer-options">
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="chat-composer-mode"
                aria-label={`Browser preparation settings: ${mode}`}
                title={`Browser preparation: ${mode}`}
                data-autonomous={autonomous ? '' : undefined}
                disabled={props.working}
              />
            }
          >
            <Globe size={14} aria-hidden="true" />
            <span>{autonomous ? 'Autonomous' : 'Supervised'}</span>
          </PopoverTrigger>
          <PopoverContent className="chat-composer-options-panel w-80 max-w-[calc(100vw-24px)] space-y-3 p-3 font-sans text-sm">
            <PopoverTitle className="font-sans text-sm font-semibold">
              Browser preparation
            </PopoverTitle>
            {picker}
            <p className="text-detail text-muted-foreground">
              Applies to the next turn. Submission always asks for your approval.
            </p>
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
}, deepEqual);
