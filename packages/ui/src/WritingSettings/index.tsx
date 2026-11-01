import { Button } from '@/components/ui/button/components/Button.tsx';
import { Switch } from '@/components/ui/switch/index.tsx';
import { Plus } from 'lucide-react';
import { useWritingSettings } from './hooks/useWritingSettings.ts';
import { GuidePreferences } from './components/GuidePreferences.tsx';
import { GuideProposals } from './components/GuideProposals.tsx';
import { PreferenceEditor } from './components/PreferenceEditor.tsx';
import { DetectorSettings } from './components/DetectorSettings.tsx';
import { SettingsSection } from '@/SettingsPage/components/SettingsSection.tsx';
import { SettingRow } from '@/SettingsPage/components/SettingRow.tsx';

export const WritingSettings = () => {
  const model = useWritingSettings();
  const { guide, working, change } = model;
  if (!guide) return null;
  const active = guide.preferences.filter((item) => item.enabled).length;
  return (
    <>
      <GuideProposals guide={guide} change={change} working={working} />
      <SettingsSection
        id="writing-heading"
        title="Writing guide"
        count={`${active} active`}
        description="Writer and Reviewer share this guide. Your explicit preferences take precedence over learned ones."
        actions={
          <Button size="sm" onClick={() => model.setEditing(null)}>
            <Plus size={14} aria-hidden="true" /> Add preference
          </Button>
        }
      >
        <SettingRow
          id="writing-learning"
          title="Learn from chat corrections"
          description="Learn after consistent corrections across two applications. Older conversations stay excluded."
        >
          <Switch
            id="writing-learning"
            aria-labelledby="writing-learning-label"
            aria-describedby="writing-learning-description"
            checked={guide.automatic}
            disabled={working}
            onCheckedChange={(automatic) =>
              void change({ action: 'learning', automatic }).catch(() => {})
            }
          />
        </SettingRow>
        <GuidePreferences guide={guide} change={change} working={working} edit={model.setEditing} />
      </SettingsSection>
      <DetectorSettings />
      {model.editing !== undefined ? (
        <PreferenceEditor
          key={model.editing?.id ?? 'new'}
          preference={model.editing}
          revision={guide.revision}
          change={change}
          close={() => model.setEditing(undefined)}
          working={working}
        />
      ) : null}
    </>
  );
};
