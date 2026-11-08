import { useBrowserAddress } from '../hooks/useBrowserAddress.ts';
import { Globe, Lock } from 'lucide-react';
import { BrowserAddressAction } from './BrowserAddressAction.tsx';
import { Input } from '@pitchcrew/design-system/input';
import type { BrowserFrame } from '@pitchcrew/core';
import type { BrowserControl } from '../types.ts';
import { addressParts, normalizeAddress } from '../helpers.ts';
export const BrowserAddress = ({
  frame,
  control,
  url,
  contextId,
  onNavigate,
  onOpenExternal,
  secure,
}: {
  /** Defaults to the address scheme; native pages pass whether the HTTPS page committed. */
  secure?: boolean;
  frame: BrowserFrame | null;
  control: BrowserControl;
  url: string;
  contextId?: string;
  onNavigate?: () => void;
  /** Offered beside an unedited web address; hidden while typing. */
  onOpenExternal?: () => void;
}) => {
  const address = url === 'about:blank' ? '' : url;
  const { input, ...model } = useBrowserAddress(address, control.leaseId, contextId);
  // The field shows the saved address as host and path until the field is edited.
  const parts = model.value === address ? addressParts(address) : null;
  const editing = model.value !== address && !!model.value.trim();
  const usable = control.available && !control.working;
  return (
    <form
      className="browser-address"
      data-display={parts ? '' : undefined}
      onSubmit={(event) => {
        event.preventDefault();
        if (!usable || !model.draft.trim()) return;
        const target = normalizeAddress(model.draft);
        input.current?.blur();
        // While the agent is idle, navigating is browsing: it takes control first.
        void control.command(async () => {
          const lease = await control.ensure();
          if (!lease) return;
          control.input({ kind: 'navigate', url: target }, lease);
          onNavigate?.();
        });
      }}
    >
      {parts && (secure ?? address.startsWith('https:')) ? (
        <Lock size={13} aria-label="Secure connection" />
      ) : (
        <Globe size={14} aria-hidden="true" />
      )}
      {parts ? (
        <span className="browser-address-display" aria-hidden="true">
          <strong>{parts.host}</strong>
          <span>{parts.rest}</span>
        </span>
      ) : null}
      <Input
        ref={input}
        key={control.leaseId ?? 'watch'}
        name="browserAddress"
        type="text"
        aria-label="Browser address"
        title={frame?.title ? `${frame.title} · ${url}` : url}
        autoComplete="off"
        spellCheck={false}
        value={model.value}
        onChange={(event) => model.setDraft(event.target.value)}
        onFocus={model.focus}
        onBlur={model.blur}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault();
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          model.reset();
          onNavigate?.();
        }}
        readOnly={!usable}
        placeholder={control.available ? 'Search or enter an address' : 'No page open'}
      />
      <BrowserAddressAction
        editing={editing}
        usable={usable}
        pending={control.inputPending > 0}
        onOpenExternal={parts ? onOpenExternal : undefined}
      />
    </form>
  );
};
