import {
  WritingSettings,
  BackgroundServiceSettings,
  AnalyticsSettings,
  ConnectorSettings,
  ExternalMcpSettings,
  RemoteMcpSettings,
  JobSourcesSettings,
  PacketRulesSettings,
  RuntimeSettings,
  UpdatesSettings,
} from './panels.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { Tabs } from '@pitchcrew/design-system/tabs';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { DataSettings } from './components/DataSettings.tsx';
import { GeneralSettings } from './components/GeneralSettings.tsx';
import { SettingsPanel } from './components/SettingsPanel.tsx';
import { SettingsTabs } from './components/SettingsTabs.tsx';
import { validateSettingsSearch } from './helpers.ts';
import { useCompactSettings } from './hooks/useCompactSettings.ts';
import { useSavedStamps } from './hooks/useSavedStamps.ts';
import { useSettingFocus } from './hooks/useSettingFocus.ts';
import { SettingsCompact } from './layout-context.ts';

export const SettingsPage = () => {
  useSettingFocus();
  const [compact, layout] = useCompactSettings();
  const { root, status } = useSavedStamps();
  const { section } = useSearch({ from: '/settings' });
  const navigate = useNavigate({ from: '/settings' });
  const data = useWorkspaceStore((state) => state.data);
  const action = useWorkspaceStore((state) => state.action);
  const working = useWorkspaceStore((state) => state.working);
  if (!data) return null;
  return (
    <div className="settings-page" ref={layout}>
      <SettingsCompact value={compact}>
        <Tabs
          ref={root}
          className="settings-layout"
          orientation={compact ? 'horizontal' : 'vertical'}
          value={section}
          onValueChange={(value) =>
            void navigate({ search: validateSettingsSearch({ section: value }), hash: '' })
          }
        >
          <SettingsTabs compact={compact} />
          <SettingsPanel value="general">
            <GeneralSettings />
          </SettingsPanel>
          <SettingsPanel value="accounts">
            <ConnectorSettings data={data} action={action} working={working} />
            <ExternalMcpSettings />
            <RemoteMcpSettings />
          </SettingsPanel>
          <SettingsPanel value="sources">
            <JobSourcesSettings />
          </SettingsPanel>
          <SettingsPanel value="runtimes">
            <RuntimeSettings runtimes={data.runtimes} />
          </SettingsPanel>
          <SettingsPanel value="writing">
            <WritingSettings />
          </SettingsPanel>
          <SettingsPanel value="rules" wide>
            {data.packetRules ? <PacketRulesSettings state={data.packetRules} /> : null}
          </SettingsPanel>
          <SettingsPanel value="updates">
            <UpdatesSettings />
          </SettingsPanel>
          <SettingsPanel value="privacy">
            <AnalyticsSettings />
          </SettingsPanel>
          <SettingsPanel value="data">
            <DataSettings directory={data.dataDirectory} />
            <BackgroundServiceSettings />
          </SettingsPanel>
        </Tabs>
      </SettingsCompact>
      <output ref={status} className="sr-only" aria-live="polite" />
    </div>
  );
};
