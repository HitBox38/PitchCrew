import type { ComposerHintProps } from '@/ChatView/types.ts';

/** Only the demo runtime gets a note under the composer; the placeholder covers the rest. */
export const ComposerHint = ({ role }: ComposerHintProps) =>
  role.runtime === 'demo' ? (
    <p className="chat-compose-hint">
      <span>Demo replies are scripted</span>
    </p>
  ) : null;
