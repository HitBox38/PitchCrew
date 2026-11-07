import type { ComposerHintProps } from '@/ChatView/types.ts';

/** Development-only scripted runtimes retain their explicit provenance note. */
export const ComposerHint = ({ role }: ComposerHintProps) =>
  role.runtime === 'demo' ? (
    <p className="chat-compose-hint">
      <span>Demo replies are scripted</span>
    </p>
  ) : null;
