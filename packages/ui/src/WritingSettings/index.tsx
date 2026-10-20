import { Button } from '@/components/ui/button/components/Button.tsx';
import { Switch } from '@/components/ui/switch/index.tsx';
import { useWritingSettings } from './hooks/useWritingSettings.ts';
import { GuidePreferences } from './components/GuidePreferences.tsx';
import { GuideProposals } from './components/GuideProposals.tsx';
import { PreferenceEditor } from './components/PreferenceEditor.tsx';

export const WritingSettings = () => {
  const model = useWritingSettings();
  const { guide, working, change } = model;
  if (!guide) return null;
  return (
    <section className="settings-section space-y-5" aria-labelledby="writing-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="writing-heading">Writing guide</h2>
        <Button onClick={() => model.setEditing(null)}>Add preference</Button>
      </div>
      <p className="quiet max-w-prose">
        Writer and Reviewer share your guide. Explicit preferences take precedence. Pipeline Coach
        can propose improvements for you to review.
      </p>
      <label className="settings-row" htmlFor="writing-learning">
        <span>
          <strong>Learn from chat corrections</strong>
          <span className="quiet block">
            Learn after consistent corrections across two applications. Older conversations stay
            excluded.
          </span>
        </span>
        <Switch
          id="writing-learning"
          checked={guide.automatic}
          disabled={working}
          onCheckedChange={(automatic) =>
            void change({ action: 'learning', automatic }).catch(() => {})
          }
        />
      </label>
      <GuidePreferences guide={guide} change={change} working={working} edit={model.setEditing} />
      <GuideProposals guide={guide} change={change} working={working} />
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
    </section>
  );
};
