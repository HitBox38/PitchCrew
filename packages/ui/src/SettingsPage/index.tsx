import { WritingSettings } from '@/WritingSettings/index.tsx';
import { BackgroundServiceSettings } from '@/BackgroundServiceSettings/index.tsx';
import { AnalyticsSettings } from '@/Analytics/components/AnalyticsSettings.tsx';
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
import { useIsMobile } from '@/hooks/use-mobile.ts';
import { UpdateSettings } from '@/AppUpdates/components/UpdateSettings.tsx';
import { SkillUpdateSettings } from '@/AgentUpdates/components/SkillUpdateSettings.tsx';

export function SettingsPage() {
  const mobile = useIsMobile();
  const { section } = useSearch({ from: '/settings' });
  const navigate = useNavigate({ from: '/settings' });
  const data = useWorkspaceStore((state) => state.data);
  const action = useWorkspaceStore((state) => state.action);
  const working = useWorkspaceStore((state) => state.working);
  if (!data) return null;
  return (
    <Tabs
      className="settings-layout min-h-0 min-w-0 flex-1 gap-0"
      orientation={mobile ? 'horizontal' : 'vertical'}
      value={section}
      onValueChange={(value) =>
        void navigate({ search: validateSettingsSearch({ section: value }) })
      }
    >
      <SettingsTabs />
      <TabsContent className="settings-content" value="general">
        <AppearanceSettings />
        <NotificationSettings />
        <UpdateSettings />
        <SkillUpdateSettings />
        <AnalyticsSettings />
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
      <TabsContent className="settings-content settings-rules-content" value="rules">
        {data.packetRules ? <PacketRulesSettings state={data.packetRules} /> : null}
      </TabsContent>
      <TabsContent className="settings-content" value="writing">
        <WritingSettings />
      </TabsContent>
      <TabsContent className="settings-content" value="data">
        <DataSettings directory={data.dataDirectory} />
        <BackgroundServiceSettings />
      </TabsContent>
    </Tabs>
  );
}
