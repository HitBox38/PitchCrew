import { WritingSettings } from '@/WritingSettings/index.tsx';
import { BackgroundServiceSettings } from '@/BackgroundServiceSettings/index.tsx';
import { AnalyticsSettings } from '@/Analytics/components/AnalyticsSettings.tsx';
import { ConnectorSettings } from '@/ConnectorSettings/index.tsx';
import { ExternalMcpSettings } from '@/ExternalMcpSettings/index.tsx';
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
import { useCompactSettings } from './hooks/useCompactSettings.ts';
import { UpdateSettings } from '@/AppUpdates/components/UpdateSettings.tsx';
import { SkillUpdateSettings } from '@/AgentUpdates/components/SkillUpdateSettings.tsx';
import { SettingsIntro } from './components/SettingsIntro.tsx';
import { RuntimeUpdatesLink } from './components/RuntimeUpdatesLink.tsx';
import { useSettingFocus } from './hooks/useSettingFocus.ts';

export const SettingsPage = () => {
  useSettingFocus();
  const [compact, layout] = useCompactSettings();
  const { section } = useSearch({ from: '/settings' });
  const navigate = useNavigate({ from: '/settings' });
  const data = useWorkspaceStore((state) => state.data);
  const action = useWorkspaceStore((state) => state.action);
  const working = useWorkspaceStore((state) => state.working);
  if (!data) return null;
  return (
    <Tabs
      ref={layout}
      className="settings-layout min-h-0 min-w-0 flex-1 gap-0"
      orientation={compact ? 'horizontal' : 'vertical'}
      value={section}
      onValueChange={(value) =>
        void navigate({ search: validateSettingsSearch({ section: value }) })
      }
    >
      <SettingsTabs compact={compact} />
      <TabsContent className="settings-content" value="general">
        <SettingsIntro
          title="General"
          description="Make this workspace comfortable. These preferences save automatically on this device."
        />
        <AppearanceSettings />
        <NotificationSettings />
      </TabsContent>
      <TabsContent className="settings-content" value="updates">
        <SettingsIntro
          title="Updates"
          description="Keep Pitchcrew and your crew’s instructions current. You choose when to install or apply an update."
        />
        <UpdateSettings />
        <SkillUpdateSettings />
        <RuntimeUpdatesLink />
      </TabsContent>
      <TabsContent className="settings-content" value="privacy">
        <SettingsIntro
          title="Privacy"
          description="Choose what you share to help improve Pitchcrew. Your preferences save automatically on this device."
        />
        <AnalyticsSettings />
      </TabsContent>
      <TabsContent className="settings-content" value="accounts">
        <ConnectorSettings data={data} action={action} working={working} />
        <ExternalMcpSettings />
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
        <SettingsIntro
          title="Local data"
          description="Your workspace lives on this machine. Find its files and manage when Pitchcrew runs in the background."
        />
        <DataSettings directory={data.dataDirectory} />
        <BackgroundServiceSettings />
      </TabsContent>
    </Tabs>
  );
};
