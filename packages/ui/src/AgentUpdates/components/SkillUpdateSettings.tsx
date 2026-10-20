import { Switch } from '@/components/ui/switch/index.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { SkillCheckButton } from './SkillCheckButton.tsx';

export const SkillUpdateSettings = () => {
  const automatic = useWorkspaceStore((state) => state.data?.skillUpdates?.automatic ?? true);
  const act = useWorkspaceStore((state) => state.act);
  const working = useWorkspaceStore((state) => state.working);
  return (
    <section className="settings-section" aria-labelledby="agent-updates-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="agent-updates-heading">Agent and skill updates</h2>
        <SkillCheckButton />
      </div>
      <p className="quiet">
        Review new default instructions and imported skill versions in Crew and Skills.
      </p>
      <label className="settings-row" htmlFor="automatic-skill-updates">
        <span>
          <strong>Check skills automatically</strong>
          <span className="quiet block">
            Check public skill sources daily while Pitchcrew is open. Updates are applied only after
            your review.
          </span>
        </span>
        <Switch
          id="automatic-skill-updates"
          checked={automatic}
          disabled={working}
          onCheckedChange={(value) =>
            act('/skills/updates/preferences', 'PUT', { automatic: value })
          }
        />
      </label>
    </section>
  );
};
