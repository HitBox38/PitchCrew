import { useRef } from 'react';
import { Button } from '@pitchcrew/design-system/button';
import { DecideHint } from '@/components/DecideHint/index.tsx';
import { useDecideShortcut } from '@/hooks/useDecideShortcut.ts';
import type { useQueueRequest } from '../hooks/useQueueRequest.ts';

type Props = {
  model: ReturnType<typeof useQueueRequest>;
  /**
   * A surface's own scope (Home's open row): Retry becomes its glaze verb, which Control/Command+
   * Enter presses while focus is inside the scope. The Queue page passes none.
   */
  shortcut?: string;
  /** When that surface showed the request (`performance.now()`); the shortcut waits after it. */
  armedAt?: number;
};

/** Retry or skip a paused/failed request, aligned under its text. */
export const QueueRequestRecovery = ({ model, shortcut, armedAt }: Props) => {
  const retry = useRef<HTMLButtonElement>(null);
  const keys = useDecideShortcut(retry, shortcut, armedAt);
  if (!model.pending || !model.failed || model.editing) return null;
  return (
    <div className="queue-request-recovery">
      <Button
        ref={retry}
        variant={shortcut ? 'default' : 'outline'}
        size="sm"
        disabled={model.working}
        aria-keyshortcuts={shortcut ? keys.aria : undefined}
        title={shortcut ? `Retry (${keys.label})` : undefined}
        onClick={() => model.command('resume')}
      >
        Retry
        {shortcut ? <DecideHint label={keys.label} /> : null}
      </Button>
      <Button variant="ghost" size="sm" disabled={model.working} onClick={() => void model.skip()}>
        Skip and continue
      </Button>
    </div>
  );
};
