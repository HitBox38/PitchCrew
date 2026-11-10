import type { ExternalMcpInfo } from '@pitchcrew/core';
import { Button } from '@pitchcrew/design-system/button';
import { AccordionSection } from '@pitchcrew/design-system/accordion';
import { RefreshCw } from 'lucide-react';
import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import { ConnectionEvidence } from './ConnectionEvidence.tsx';

export const VerifyConnection = ({
  info,
  busy,
  refresh,
}: {
  info: ExternalMcpInfo;
  busy: boolean;
  refresh: () => void;
}) =>
  info.enabled ? (
    <>
      <p className="quiet">
        Send this in your other app. It reads your workspace without starting crew work.
      </p>
      <SourceBlock
        label="Connection check prompt"
        copyLabel="Copy prompt"
        value="Use Pitchcrew to read my workspace status with pitchcrew_status. Do not make any changes or send crew messages."
      />
      <div className="settings-callout external-mcp-verification">
        <ConnectionEvidence info={info} />
        <Button variant="outline" size="sm" disabled={busy} onClick={refresh}>
          <RefreshCw size={14} aria-hidden="true" /> Check for requests
        </Button>
      </div>
      <p className="quiet">
        Shows authenticated requests for this access since Pitchcrew started, not a live connection.
        Rejected old connections cannot appear here; reconnect if your app reports revoked access.
      </p>
      <AccordionSection heading="No request received?">
        <p className="quiet">
          Keep Pitchcrew open. Confirm your app supports local stdio MCP, paste the configuration
          without replacing your other servers, and reconnect after any access change. If you moved
          or reinstalled Pitchcrew, copy a fresh configuration.
        </p>
      </AccordionSection>
    </>
  ) : (
    <p className="quiet">
      After connecting, test a read-only request here before asking your crew to work.
    </p>
  );
