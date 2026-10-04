import { ConnectorSettings } from '@/ConnectorSettings/index.tsx';
import { JobSourcesSettings } from '@/JobSourcesSettings/index.tsx';
import { PacketRulesSettings } from '@/PacketRules/index.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { Tabs } from '@/components/ui/tabs/components/Tabs.tsx';
import { TabsContent } from '@/components/ui/tabs/components/TabsContent.tsx';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { AppearanceSettings } from './components/AppearanceSettings.tsx';
import { DataSettings } from './components/DataSettings.tsx';
import { NotificationSettings } from './components/NotificationSettings.tsx';
import { RuntimeSettings } from './components/RuntimeSettings.tsx';
import { SettingsTabs } from './components/SettingsTabs.tsx';
import { validateSettingsSearch } from './helpers.ts';

export function SettingsPage() {
  const { section } = useSearch({ from: '/settings' });
  const navigate = useNavigate({ from: '/settings' });
  const data = useWorkspaceStore((state) => state.data);
  const action = useWorkspaceStore((state) => state.action);
  const working = useWorkspaceStore((state) => state.working);
  if (!data) return null;
  return (
    <Tabs
      className="settings-layout gap-0"
      value={section}
      onValueChange={(value) =>
        void navigate({ search: validateSettingsSearch({ section: value }) })
      }
    >
      <SettingsTabs />
      <TabsContent className="settings-content" value="general">
        <AppearanceSettings />
        <NotificationSettings />
      </TabsContent>
      <TabsContent className="settings-content" value="accounts">
        <ConnectorSettings data={data} action={action} working={working} />
      </TabsContent>
      <TabsContent className="settings-content" value="sources">
        <JobSourcesSettings />
      </TabsContent>
      <TabsContent className="settings-content" value="runtimes">
        <RuntimeSettings runtimes={data.runtimes} />
      </TabsContent>
      <TabsContent className="settings-content" value="rules">
        {data.packetRules ? <PacketRulesSettings state={data.packetRules} /> : null}
      </TabsContent>
      <TabsContent className="settings-content" value="data">
        <DataSettings directory={data.dataDirectory} />
      </TabsContent>
    </Tabs>
  );
}
