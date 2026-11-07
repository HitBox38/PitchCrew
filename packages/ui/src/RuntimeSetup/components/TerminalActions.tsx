import type { RuntimeId } from '@pitchcrew/core';
import { Button, buttonVariants } from '@pitchcrew/design-system/button';
import { terminalSignInActions } from '../terminal-links.ts';

export const TerminalActions = ({
  runtime,
  output,
  copy,
}: {
  runtime: RuntimeId;
  output: string;
  copy: (text: string) => void;
}) => {
  const actions = terminalSignInActions(runtime, output);
  return (
    <div className="settings-row-actions">
      {actions.links.map((url) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noreferrer"
          referrerPolicy="no-referrer"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
          data-slot="button"
          data-size="sm"
        >
          Open {new URL(url).hostname} sign-in
        </a>
      ))}
      {actions.codes.map((code) => (
        <Button key={code} variant="outline" size="sm" onClick={() => copy(code)}>
          Copy code {code}
        </Button>
      ))}
      <Button
        variant="ghost"
        size="sm"
        disabled={!actions.plain}
        onClick={() => copy(actions.plain)}
      >
        Copy terminal text
      </Button>
    </div>
  );
};
