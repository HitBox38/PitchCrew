import { currentVersionLabel, updateStatusMessage } from '../helpers.ts';
import { settingsTime } from '@/lib/settings-time.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useDevicePreferences } from '@/lib/device-preferences.ts';
import { Button } from '@pitchcrew/design-system/button';
import { Switch } from '@pitchcrew/design-system/switch';
import { RefreshCw } from 'lucide-react';
import { ReleaseLink } from './ReleaseLink.tsx';
import { DesktopUpdateActions } from './DesktopUpdateActions.tsx';
import { SettingsSection } from '@/SettingsPage/components/SettingsSection.tsx';
import { SettingRow } from '@/SettingsPage/components/SettingRow.tsx';

export const UpdateSettings = () => {
  const info = useWorkspaceStore((state) => state.appUpdate);
  const native = useWorkspaceStore((state) => state.desktopUpdate);
  const loading = useWorkspaceStore((state) => state.checkingAppUpdate);
  const error = useWorkspaceStore((state) => state.appUpdateError);
  const check = useWorkspaceStore((state) => state.checkAppUpdate);
  const automatic = useDevicePreferences((state) => state.automaticUpdates);
  const setAutomatic = useDevicePreferences((state) => state.setAutomaticUpdates);
  const automaticAvailable = !!info?.automatic && info.status !== 'disabled';
  return (
    <SettingsSection
      id="updates-heading"
      title="Pitchcrew updates"
      scope="This device"
      description={currentVersionLabel(info, native)}
      actions={
        <Button
          variant="outline"
          size="sm"
          disabled={loading || info?.status === 'disabled'}
          onClick={() => void check()}
        >
          <RefreshCw size={15} aria-hidden="true" /> {loading ? 'Checking…' : 'Check for updates'}
        </Button>
      }
    >
      <div className="settings-list settings-preferences">
        <SettingRow
          id="automatic-updates"
          title="Check automatically"
          description={
            automaticAvailable
              ? 'Check GitHub when you open Pitchcrew and once an hour. Downloads and installation are your choice.'
              : !info
                ? 'Checking whether automatic updates are available…'
                : `${info.status === 'disabled' ? info.message : 'Automatic checks are inactive in development; you can check manually.'} Your saved preference is ${automatic ? 'on' : 'off'}.`
          }
        >
          <Switch
            id="automatic-updates"
            aria-labelledby="automatic-updates-label"
            aria-describedby="automatic-updates-description"
            checked={automaticAvailable && automatic}
            onCheckedChange={setAutomatic}
            disabled={!automaticAvailable}
          />
        </SettingRow>
      </div>
      {info?.status !== 'disabled' || error || loading || native?.enabled ? (
        <output className="info-note block" aria-live="polite">
          {updateStatusMessage(info, native, loading, error)}
        </output>
      ) : null}
      {info?.checkedAt ? (
        <p className="quiet">Last checked {settingsTime(info.checkedAt)}.</p>
      ) : null}
      {info?.latest && (info.status === 'available' || info.status === 'unknown') ? (
        <ReleaseLink url={info.latest.url} />
      ) : null}
      <DesktopUpdateActions />
      {native?.status === 'disabled' && info?.current.packaged ? (
        <p className="quiet">{native.message}</p>
      ) : null}
    </SettingsSection>
  );
};
