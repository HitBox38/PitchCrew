import { useState } from 'react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/index.tsx';
import type { BrowserFrame } from '@pitchcrew/core';
import type { BrowserControl } from '../types.ts';
export const BrowserDialog = ({
  dialog,
  control,
}: {
  dialog: NonNullable<BrowserFrame['dialog']>;
  control: BrowserControl;
}) => {
  const [text, setText] = useState('');
  return (
    <section className="browser-dialog" aria-label="Website dialog">
      <p>{dialog.message}</p>
      {control.leaseId ? (
        <>
          {dialog.type === 'prompt' ? (
            <Input
              aria-label="Website prompt answer"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          ) : null}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => control.input({ kind: 'dialog', decision: 'dismiss' })}
            >
              Dismiss
            </Button>
            <Button
              size="sm"
              onClick={() => {
                control.input({ kind: 'dialog', decision: 'accept', text });
                setText('');
              }}
            >
              Accept
            </Button>
          </div>
        </>
      ) : (
        <p className="quiet">Take control or review the agent’s exact dialog action below.</p>
      )}
    </section>
  );
};
