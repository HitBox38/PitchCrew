import { useBrowserAddress } from '../hooks/useBrowserAddress.ts';
import { ArrowRight, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/index.tsx';
import type { BrowserFrame } from '@pitchcrew/core';
import type { BrowserControl } from '../types.ts';
export const BrowserAddress = ({
  frame,
  control,
  url,
  contextId,
  onNavigate,
}: {
  frame: BrowserFrame | null;
  control: BrowserControl;
  url: string;
  contextId?: string;
  onNavigate?: () => void;
}) => {
  const address = url === 'about:blank' ? '' : url;
  const input = useBrowserAddress(address, control.leaseId, contextId);
  return (
    <form
      className="browser-address"
      onSubmit={(event) => {
        event.preventDefault();
        if (!control.leaseId) return;
        if (!String(new FormData(event.currentTarget).get('browserAddress') ?? '').trim()) return;
        control.input({
          kind: 'navigate',
          url: normalizeAddress(
            String(new FormData(event.currentTarget).get('browserAddress') ?? ''),
          ),
        });
        onNavigate?.();
      }}
    >
      <Globe size={14} aria-hidden="true" />
      <Input
        ref={input}
        key={control.leaseId ?? 'watch'}
        name="browserAddress"
        type="text"
        aria-label="Browser address"
        title={frame?.title ? `${frame.title} · ${url}` : url}
        autoComplete="off"
        spellCheck={false}
        defaultValue={address}
        readOnly={!control.leaseId || control.working}
        placeholder={control.leaseId ? 'https://example.com…' : 'No page open'}
      />
      {control.leaseId ? (
        <Button
          type="submit"
          size="icon-sm"
          variant="ghost"
          aria-label="Go to address"
          title="Go to address"
          disabled={control.inputPending > 0 || control.working}
        >
          <ArrowRight size={15} />
        </Button>
      ) : null}
    </form>
  );
};

const normalizeAddress = (input: string) => {
  const value = input.trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[^\s/]+\.[^\s]+$/.test(value)) return `https://${value}`;
  return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
};
