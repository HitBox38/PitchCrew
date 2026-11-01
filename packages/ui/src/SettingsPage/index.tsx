import { WritingSettings } from '@/WritingSettings/index.tsx';
import { BackgroundServiceSettings } from '@/BackgroundServiceSettings/index.tsx';
import { AnalyticsSettings } from '@/Analytics/components/AnalyticsSettings.tsx';
import { ConnectorSettings } from '@/ConnectorSettings/index.tsx';
import { ExternalMcpSettings } from '@/ExternalMcpSettings/index.tsx';
import { JobSourcesSettings } from '@/JobSourcesSettings/index.tsx';
import { PacketRulesSettings } from '@/PacketRules/index.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { Tabs } from '@pitchcrew/design-system/tabs';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { DataSettings } from './components/DataSettings.tsx';
import { GeneralSettings } from './components/GeneralSettings.tsx';
import { RuntimeSettings } from './components/RuntimeSettings.tsx';
import { SettingsPanel } from './components/SettingsPanel.tsx';
import { SettingsTabs } from './components/SettingsTabs.tsx';
import { UpdatesSettings } from './components/UpdatesSettings.tsx';
import { validateSettingsSearch } from './helpers.ts';
import { useCompactSettings } from './hooks/useCompactSettings.ts';
import { useSavedStamps } from './hooks/useSavedStamps.ts';
import { useSettingFocus } from './hooks/useSettingFocus.ts';

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
      <Tabs
        ref={root}
        className="settings-layout"
        orientation={compact ? 'horizontal' : 'vertical'}
        value={section}
        onValueChange={(value) =>
          void navigate({ search: validateSettingsSearch({ section: value }) })
        }
      >
        <SettingsTabs compact={compact} />
        <SettingsPanel value="general">
          <GeneralSettings />
        </SettingsPanel>
        <SettingsPanel value="accounts">
          <ConnectorSettings data={data} action={action} working={working} />
          <ExternalMcpSettings />
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
      <output ref={status} className="sr-only" aria-live="polite" />
    </div>
  );
};
