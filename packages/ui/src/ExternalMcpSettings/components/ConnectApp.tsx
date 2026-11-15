import { useState } from 'react';
import type { ExternalMcpInfo } from '@pitchcrew/core';
import { FormSelect } from '@/FormSelect/index.tsx';
import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import { externalConfiguration, type ConfigurationFormat } from '../configuration.ts';

const formats = [
  { value: 'json', label: 'JSON configuration' },
  { value: 'codex', label: 'Codex' },
] as const;

export const ConnectApp = ({ info }: { info: ExternalMcpInfo }) => {
  const [format, setFormat] = useState<ConfigurationFormat>('json');
  if (!info.enabled)
    return (
      <p className="quiet">Enable access above to get the configuration for this workspace.</p>
    );
  return (
    <div className="settings-config">
      <FormSelect
        label="Configuration for"
        value={format}
        onValueChange={setFormat}
        options={formats}
        describedBy="external-mcp-config-help"
      />
      <p className="quiet" id="external-mcp-config-help">
        {format === 'codex'
          ? 'Add this server entry to config.toml in your Codex home (normally ~/.codex). If a Pitchcrew entry already exists, replace that entry; keep your other settings. Restart Codex afterward.'
          : 'In a local app that accepts mcpServers JSON, merge this entry with your existing MCP servers. Keep your other servers, then reconnect the Pitchcrew server.'}
      </p>
      <SourceBlock
        label="Pitchcrew MCP configuration"
        value={externalConfiguration(info.configuration, format)}
        contentClassName="max-h-40"
        copyLabel="Copy configuration"
      />
      <p className="quiet">
        Keep Pitchcrew running on this computer. These paths belong to this installation and
        workspace; moving or deleting its executable, checkout or data folder breaks the connection.
        Copy a fresh configuration after moving or reinstalling.
      </p>
      <p className="quiet">
        The configuration contains no credential. Only use apps you trust with your career data.
      </p>
    </div>
  );
};
