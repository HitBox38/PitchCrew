import { useState } from 'react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/index.tsx';
import { browserCommand } from '../api.ts';
import type { BrowserControl, AgentBrowserProps } from '../types.ts';
import { BrowserReset } from './BrowserReset.tsx';
import type { BrowserFrame } from '@pitchcrew/core';
export function BrowserControls({
  browserPanel,
  thread,
  control,
  frame,
}: Pick<AgentBrowserProps, 'browserPanel' | 'thread'> & {
  control: BrowserControl;
  frame: BrowserFrame | null;
}) {
  const [address, setAddress] = useState('');
  const roleId = browserPanel.role!.id;
  const opened = browserPanel.session?.status === 'open';
  return (
    <div className="browser-controls" data-browser-controls>
      <div className="flex flex-wrap gap-2">
        {!opened ? (
          <Button
            size="sm"
            disabled={control.working}
            onClick={() => void control.command(() => browserCommand(roleId, thread, 'open'))}
          >
            Open browser
          </Button>
        ) : control.leaseId ? (
          <Button size="sm" disabled={control.working} onClick={() => void control.release()}>
            Return control to agent
          </Button>
        ) : (
          <Button size="sm" disabled={control.working} onClick={() => void control.take()}>
            {browserPanel.session?.manual ? 'Recover manual control' : 'Take control'}
          </Button>
        )}
        {opened ? (
          <Button
            variant="outline"
            size="sm"
            disabled={control.working}
            onClick={() =>
              void control.command(async () => {
                await browserCommand(roleId, thread, 'close');
                control.forget();
              })
            }
          >
            {browserPanel.session?.runId ? 'Stop run and close browser' : 'Close browser'}
          </Button>
        ) : null}
        <BrowserReset roleId={roleId} thread={thread} control={control} />
      </div>
      {control.leaseId ? (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            control.input({ kind: 'navigate', url: address || frame?.url || '' });
            setAddress('');
          }}
        >
          <Input
            aria-label="Browser address"
            value={address}
            placeholder={frame?.url || 'https://…'}
            onChange={(event) => setAddress(event.target.value)}
          />
          <Button type="submit" size="sm">
            Go
          </Button>
        </form>
      ) : null}
      <p className="quiet">
        {control.leaseId
          ? 'You have control. Click the page to type; Escape returns to these controls. Agent actions and inspection are paused.'
          : browserPanel.session?.manual
            ? 'Agent actions and inspection are paused until you return control.'
            : 'Sign-ins are saved only in this agent’s local browser profile.'}
      </p>
    </div>
  );
}
