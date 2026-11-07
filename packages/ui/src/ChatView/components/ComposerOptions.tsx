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

/** Keep preparation permissions reachable when the chat lane cannot fit another picker. */
export const ComposerOptions = (props: ChatComposerProps) => {
  if (!props.role.capabilities?.computerUse) return null;
  const role = props.browserPanel.roles.find((item) => item.id === props.role.id) ?? props.role;
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
};
