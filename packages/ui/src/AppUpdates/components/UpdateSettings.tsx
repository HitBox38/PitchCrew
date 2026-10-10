import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useDevicePreferences } from '@/lib/device-preferences.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Checkbox } from '@/components/ui/checkbox/index.tsx';
import { RefreshCw } from 'lucide-react';
import { ReleaseLink } from './ReleaseLink.tsx';

export function UpdateSettings() {
  const info = useWorkspaceStore((state) => state.appUpdate);
  const loading = useWorkspaceStore((state) => state.checkingAppUpdate);
  const error = useWorkspaceStore((state) => state.appUpdateError);
  const check = useWorkspaceStore((state) => state.checkAppUpdate);
  const automatic = useDevicePreferences((state) => state.automaticUpdates);
  const setAutomatic = useDevicePreferences((state) => state.setAutomaticUpdates);
  return (
    <section className="settings-section" aria-labelledby="updates-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="updates-heading">Pitchcrew updates</h2>
        <Button
          className="button"
          disabled={loading || info?.status === 'disabled'}
          onClick={() => void check()}
        >
          <RefreshCw size={15} aria-hidden="true" /> {loading ? 'Checking…' : 'Check for updates'}
        </Button>
      </div>
      <p className="quiet">
        {info
          ? `Version ${info.current.version}${info.current.commit ? ` · Build ${info.current.commit.slice(0, 12)}` : ' · Build unknown'}`
          : 'Loading version…'}
        {info && !info.current.packaged ? ' · Source checkout' : ''}
      </p>
      <label className="settings-row" htmlFor="automatic-updates" aria-label="Check automatically">
        <span>
          <strong>Check automatically</strong>
          <span className="quiet block">
            Check GitHub when you open Pitchcrew and once an hour. Downloads and installation are
            your choice.
          </span>
        </span>
        <div className="flex shrink-0">
          <Checkbox
            id="automatic-updates"
            checked={automatic}
            onCheckedChange={setAutomatic}
            disabled={!info?.automatic}
          />
        </div>
      </label>
      {info && !info.automatic && info.status !== 'disabled' ? (
        <p className="info-note">
          Automatic checks are off in development. You can check manually.
        </p>
      ) : null}
      <output className="info-note block" aria-live="polite">
        {error || (loading ? 'Checking for updates…' : info?.message)}
      </output>
      {info?.checkedAt ? (
        <p className="quiet">Last checked {new Date(info.checkedAt).toLocaleString()}.</p>
      ) : null}
      {info?.latest && (info.status === 'available' || info.status === 'unknown') ? (
        <ReleaseLink url={info.latest.url} />
      ) : null}
    </section>
  );
}
