import { useState } from 'react';
import { Keyboard, X } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Textarea } from '@/components/ui/textarea/index.tsx';
import type { BrowserControl } from '../types.ts';
import { BrowserInputKeys } from './BrowserInputKeys.tsx';
export const BrowserManualInput = ({ control }: { control: BrowserControl }) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  return (
    <div className="browser-manual-input">
      <div className="flex items-center justify-between gap-2">
        <Button
          className="text-button"
          variant="ghost"
          size="sm"
          aria-expanded={open}
          aria-controls="browser-private-input"
          onClick={() => {
            setOpen(!open);
            setText('');
          }}
        >
          <Keyboard size={16} />
          {open ? 'Hide keyboard' : 'Type on page'}
        </Button>
        <output className="quiet" aria-live="polite">
          {control.inputPending ? 'Sending input…' : 'Private · Agent can’t inspect'}
        </output>
      </div>
      {open ? (
        <div id="browser-private-input">
          <p className="quiet">Tap a field on the page, then enter text here.</p>
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!text) return;
              control.input({ kind: 'text', text });
              setText('');
            }}
          >
            <Textarea
              name="privateBrowserText"
              aria-label="Private browser text"
              autoComplete="off"
              spellCheck={false}
              rows={2}
              maxLength={12000}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <Button type="submit" size="sm" disabled={!text || control.inputPending > 0}>
              Send text
            </Button>
            <Button
              className="icon-button"
              variant="ghost"
              size="icon-sm"
              aria-label="Clear private text"
              onClick={() => setText('')}
            >
              <X size={14} />
            </Button>
          </form>
          <BrowserInputKeys control={control} />
        </div>
      ) : null}
    </div>
  );
};
