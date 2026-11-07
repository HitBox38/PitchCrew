import { Switch } from '@pitchcrew/design-system/switch';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { SkillCheckButton } from './SkillCheckButton.tsx';
import { SettingsSection } from '@/SettingsPage/components/SettingsSection.tsx';
import { SettingRow } from '@/SettingsPage/components/SettingRow.tsx';

export const SkillUpdateSettings = () => {
  const automatic = useWorkspaceStore((state) => state.data?.skillUpdates?.automatic ?? true);
  const act = useWorkspaceStore((state) => state.act);
  const working = useWorkspaceStore((state) => state.working);
  return (
    <SettingsSection
      id="agent-updates-heading"
      title="Agent and skill updates"
      scope="This workspace"
      actions={<SkillCheckButton />}
      description="Review new default instructions and imported skill versions in Crew and Skills."
    >
      <div className="settings-list settings-preferences">
        <SettingRow
          id="automatic-skill-updates"
          title="Check skills automatically"
          description="Check public skill sources daily while Pitchcrew is open. Updates are applied only after your review."
        >
          <Switch
            id="automatic-skill-updates"
            aria-labelledby="automatic-skill-updates-label"
            aria-describedby="automatic-skill-updates-description"
            checked={automatic}
            disabled={working}
            onCheckedChange={(value) =>
              act('/skills/updates/preferences', 'PUT', { automatic: value })
            }
          />
        </SettingRow>
      </div>
    </SettingsSection>
  );
};
