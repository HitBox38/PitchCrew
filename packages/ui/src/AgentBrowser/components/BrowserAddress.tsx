import { ArrowRight, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/index.tsx';
import type { BrowserFrame } from '@pitchcrew/core';
import type { BrowserControl } from '../types.ts';
export const BrowserAddress = ({
  frame,
  control,
  url,
}: {
  frame: BrowserFrame | null;
  control: BrowserControl;
  url: string;
}) => {
  const address = url === 'about:blank' ? '' : url;
  return (
    <form
      className="browser-address"
      onSubmit={(event) => {
        event.preventDefault();
        if (!control.leaseId) return;
        control.input({
          kind: 'navigate',
          url: String(new FormData(event.currentTarget).get('browserAddress') ?? ''),
        });
      }}
    >
      <Globe size={14} aria-hidden="true" />
      <Input
        key={`${control.leaseId ?? 'watch'}:${url}`}
        name="browserAddress"
        type="url"
        aria-label="Browser address"
        title={frame?.title ? `${frame.title} · ${url}` : url}
        autoComplete="off"
        spellCheck={false}
        defaultValue={address}
        readOnly={!control.leaseId}
        placeholder={control.leaseId ? 'https://example.com…' : 'No page open'}
      />
      {control.leaseId ? (
        <Button
          type="submit"
          size="icon-sm"
          variant="ghost"
          aria-label="Go to address"
          title="Go to address"
          disabled={control.inputPending > 0}
        >
          <ArrowRight size={15} />
        </Button>
      ) : null}
    </form>
  );
};
