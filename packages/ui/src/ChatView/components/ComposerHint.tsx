import type { ComposerHintProps } from '@/ChatView/types.ts';

export function ComposerHint({ role }: ComposerHintProps) {
  return (
    <p className="chat-compose-hint">
      <span>
        Enter to send <span aria-hidden="true">·</span> Shift + Enter for a new line
      </span>
      <span>{role.runtime === 'demo' ? 'Demo replies are scripted' : 'Saved on this device'}</span>
    </p>
  );
}
