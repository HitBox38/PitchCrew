import type { RuntimeAuthInteraction, RuntimeId } from '@pitchcrew/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import '@xterm/xterm/css/xterm.css';
import { useAuthTerminalQueue } from '../hooks/useAuthTerminalQueue.ts';
import { useAuthTerminalSurface } from '../hooks/useAuthTerminalSurface.ts';
import { TerminalActions } from './TerminalActions.tsx';

export default function AuthTerminal({
  runtime,
  flowId,
  interaction,
  visible,
}: {
  runtime: RuntimeId;
  flowId: string;
  interaction: Extract<RuntimeAuthInteraction, { type: 'terminal' }>;
  visible: boolean;
}) {
  const model = useAuthTerminalQueue(runtime, flowId, interaction.id);
  const [copied, setCopied] = useState('');
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyRequest = useRef(0);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);
  const copy = useCallback((text: string) => {
    const request = ++copyRequest.current;
    if (copyTimer.current) clearTimeout(copyTimer.current);
    setCopied('');
    const feedback = (message: string) => {
      if (!active.current || request !== copyRequest.current) return;
      if (copyTimer.current) clearTimeout(copyTimer.current);
      setCopied(message);
      copyTimer.current = setTimeout(() => setCopied(''), 4000);
    };
    void navigator.clipboard.writeText(text).then(
      () => feedback('Copied. Sign-in is still waiting.'),
      () => feedback('Clipboard is unavailable. Select the terminal text to copy it.'),
    );
  }, []);
  const { element, text } = useAuthTerminalSurface(
    interaction,
    model.send,
    visible && !model.error,
    copy,
  );
  return (
    <div className="settings-stack ph-no-capture">
      <p className="quiet runtime-terminal-keyboard-hint">
        Tab leaves the terminal. Ctrl/Cmd+C copies a selection; Ctrl+C without a selection
        interrupts the CLI.
      </p>
      <section
        ref={element}
        className="runtime-auth-terminal"
        aria-label="Runtime sign-in terminal"
      />
      <TerminalActions runtime={runtime} output={text} copy={copy} />
      {copied ? (
        <output className="quiet" aria-live="polite">
          {copied}
        </output>
      ) : null}
      {model.error ? (
        <p role="alert" className="form-error">
          {model.error}
        </p>
      ) : null}
    </div>
  );
}
