import { ArrowUpRight, Globe, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { BrowserControl } from '../types.ts';

export const BrowserPlaceholder = ({
  loading,
  opened,
  name,
  control,
}: {
  loading: boolean;
  opened: boolean;
  name?: string;
  control: BrowserControl;
}) => {
  const manual = !!control.leaseId;
  return (
    <div className="browser-placeholder" aria-busy={loading}>
      <div className="browser-placeholder-content">
        <div className="browser-placeholder-icon" aria-hidden="true">
          {loading ? <LoaderCircle className="browser-spinner" /> : <Globe />}
        </div>
        <div className="browser-placeholder-copy">
          <h3 role={loading ? 'status' : undefined}>
            {loading ? (opened ? 'Connecting to browser…' : 'Opening browser…') : 'No page open'}
          </h3>
          <p>
            {loading
              ? 'Your page will appear here when it’s ready.'
              : manual
                ? 'Enter a website address above to get started.'
                : opened
                  ? 'Take control to open a website, or ask your agent to browse.'
                  : `Ask ${name ?? 'your agent'} to browse, or open the browser to sign in.`}
          </p>
        </div>
        {!loading ? (
          <Button
            size="sm"
            variant="outline"
            disabled={control.working}
            onClick={() => {
              if (!opened) void control.open();
              else if (!manual) void control.take();
              else {
                const address = document.querySelector<HTMLInputElement>(
                  '#agent-browser-panel [aria-label="Browser address"]',
                );
                address?.focus();
                address?.select();
              }
            }}
          >
            {opened ? (manual ? 'Enter an address' : 'Take control to browse') : 'Open browser'}
            <ArrowUpRight size={14} />
          </Button>
        ) : null}
        {!loading ? (
          <p className="browser-placeholder-note">
            Sign-ins stay with this agent’s browser profile.
          </p>
        ) : null}
      </div>
    </div>
  );
};
